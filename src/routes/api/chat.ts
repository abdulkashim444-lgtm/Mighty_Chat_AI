import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  generateText,
  type UIMessage,
} from "ai";
import {
  createLovableAiGatewayProvider,
  getLovableAiGatewayRunId,
  getLovableAiGatewayResponseHeaders,
  withLovableAiGatewayRunIdHeader,
} from "@/lib/ai-gateway.server";
import { createImageTool, fetchUrlTool, webSearchTool } from "@/lib/chat-tools.server";

const CHAT_MODEL = "google/gemini-3.6-flash";
const TITLE_MODEL = "google/gemini-3.1-flash-lite";

const SYSTEM_PROMPT = `You are Mighty, a highly capable AI assistant.

Guidelines:
- Be accurate, direct and genuinely useful. Think before answering hard problems.
- Format answers in clean markdown: short paragraphs, headings when helpful, tables for comparisons, fenced code blocks with a language tag.
- Use the web_search tool whenever the question involves current events, recent releases, prices, statistics, people, or anything you may be out of date on. Follow up with read_url when a page deserves a close read, and cite sources as markdown links.
- Use the generate_image tool when the user asks for an image, illustration, logo or any visual to be created. Never claim you cannot make images.
- When the user attaches an image or document, analyse it carefully before answering.
- Never invent facts or URLs. If something is unknown, say so.`;

type ChatBody = {
  messages?: UIMessage[];
  threadId?: string;
};

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const body = (await request.json()) as ChatBody;
        const messages = body.messages;
        const threadId = body.threadId;

        if (!Array.isArray(messages) || messages.length === 0) {
          return jsonError("Messages are required", 400);
        }
        const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
        if (token && !threadId) return jsonError("threadId is required", 400);

        const lovableApiKey = process.env["LOVABLE_API_KEY"];
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!lovableApiKey) return jsonError("AI is not configured", 500);
        if (!supabaseUrl || !supabaseKey) return jsonError("Backend is not configured", 500);

        const supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false, autoRefreshToken: false },
          global: {
            fetch: (input, init) => {
              const headers = new Headers(init?.headers);
              headers.set("apikey", supabaseKey);
              headers.set("Authorization", `Bearer ${token}`);
              return fetch(input, { ...init, headers });
            },
          },
        });

        let userId: string | undefined;
        if (token) {
          const { data: userData } = await supabase.auth.getUser(token);
          userId = userData.user?.id;
          if (!userId) return jsonError("Unauthorized", 401);
        }

        const guest = !userId;

        let thread: { id: string; title: string } | null = null;
        if (!guest) {
          const { data: threadRow, error: threadError } = await supabase
            .from("threads")
            .select("id,title")
            .eq("id", threadId!)
            .maybeSingle();
          if (threadError) return jsonError(threadError.message, 500);
          if (!threadRow) return jsonError("Conversation not found", 404);
          thread = threadRow as { id: string; title: string };
        }

        const lastMessage = messages[messages.length - 1];
        if (!guest && lastMessage?.role === "user") {
          const { error: insertError } = await supabase.from("messages").insert({
            thread_id: threadId!,
            user_id: userId!,
            role: "user",
            parts: lastMessage.parts,
            sdk_message_id: lastMessage.id,
          });
          if (insertError) console.error("[chat] failed to save user message", insertError);
        }

        const initialRunId = getLovableAiGatewayRunId(request);
        const gateway = createLovableAiGatewayProvider(lovableApiKey, initialRunId);

        const result = streamText({
          model: gateway(CHAT_MODEL),
          system: SYSTEM_PROMPT,
          messages: await convertToModelMessages(messages),
          stopWhen: stepCountIs(50),
          tools: guest
            ? { web_search: webSearchTool, read_url: fetchUrlTool }
            : {
                web_search: webSearchTool,
                read_url: fetchUrlTool,
                generate_image: createImageTool({ lovableApiKey, supabase, userId: userId! }),
              },
          providerOptions: {
            lovable: { reasoning: { effort: "low" } },
          },
          onError: ({ error }) => {
            console.error("[chat] stream error", error);
          },
        });

        const response = result.toUIMessageStreamResponse({
          originalMessages: messages,
          sendReasoning: true,
          onFinish: async ({ responseMessage }) => {
            if (guest || !thread) return;
            const { error } = await supabase.from("messages").insert({
              thread_id: threadId!,
              user_id: userId!,
              role: responseMessage.role,
              parts: responseMessage.parts,
              sdk_message_id: responseMessage.id,
              model: CHAT_MODEL,
            });
            if (error) console.error("[chat] failed to save assistant message", error);

            if (thread.title === "New chat") {
              try {
                const firstUserText = messages
                  .filter((message) => message.role === "user")
                  .flatMap((message) => message.parts)
                  .filter((part) => part.type === "text")
                  .map((part) => (part as { text: string }).text)
                  .join(" ")
                  .slice(0, 1000);

                const { text } = await generateText({
                  model: gateway(TITLE_MODEL),
                  prompt: `Write a 3-5 word title (no quotes, no punctuation at the end) for a conversation that starts with: "${firstUserText}"`,
                });
                const title = text.trim().replace(/^["']|["']$/g, "").slice(0, 70);
                if (title) {
                  await supabase.from("threads").update({ title }).eq("id", threadId);
                }
              } catch (titleError) {
                console.error("[chat] title generation failed", titleError);
              }
            }

            await supabase
              .from("threads")
              .update({ updated_at: new Date().toISOString() })
              .eq("id", threadId);
          },
          headers: getLovableAiGatewayResponseHeaders(undefined, {
            ...(initialRunId ? { "X-Lovable-AIG-Run-ID": initialRunId } : {}),
          }),
        });

        return withLovableAiGatewayRunIdHeader(response, gateway);
      },
    },
  },
});
