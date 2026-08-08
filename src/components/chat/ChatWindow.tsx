import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Globe, ImagePlus, Loader2, Paperclip, RefreshCw, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import {
  Message,
  MessageAction,
  MessageActions,
  MessageContent,
  MessageResponse,
} from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputFooter,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputTools,
} from "@/components/ai-elements/prompt-input";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { Tool, ToolContent, ToolHeader, ToolInput, ToolOutput } from "@/components/ai-elements/tool";
import { Button } from "@/components/ui/button";
import { SignedImage } from "@/components/chat/SignedImage";
import logo from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { uploadAttachment, signedUrlFor } from "@/lib/chat-store";
import { cn } from "@/lib/utils";

type Attachment = { path: string; url: string; name: string; mediaType: string };

const SUGGESTIONS = [
  "Search the web and summarise today's AI news",
  "Generate a poster of a neon desert highway",
  "Explain quantum entanglement like I'm twelve",
  "Draft a launch email for a productivity app",
];

export function ChatWindow({
  threadId,
  initialMessages,
  onFirstMessage,
  autoSend,
}: {
  threadId: string | null;
  initialMessages?: UIMessage[];
  onFirstMessage?: (payload: { text: string; parts: UIMessage["parts"] }) => void;
  autoSend?: { text: string; parts: UIMessage["parts"] } | null;
}) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const autoSentRef = useRef(false);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        prepareSendMessagesRequest: async ({ messages, id, body }) => {
          const { data } = await supabase.auth.getSession();
          return {
            headers: {
              "Content-Type": "application/json",
              ...(data.session ? { Authorization: `Bearer ${data.session.access_token}` } : {}),
            },
            body: { messages, threadId: id, ...body },
          };
        },
      }),
    [],
  );

  const { messages, sendMessage, status, error, regenerate, stop } = useChat({
    id: threadId ?? "draft",
    messages: initialMessages ?? [],
    transport,
    onError: (chatError) => toast.error(chatError.message || "Something went wrong"),
    onFinish: () => {
      void queryClient.invalidateQueries({ queryKey: ["threads"] });
      textareaRef.current?.focus();
    },
  });

  const busy = status === "submitted" || status === "streaming";

  useEffect(() => {
    textareaRef.current?.focus();
  }, [threadId]);

  useEffect(() => {
    if (!autoSend || autoSentRef.current || !threadId) return;
    autoSentRef.current = true;
    void sendMessage({ role: "user", parts: autoSend.parts });
  }, [autoSend, sendMessage, threadId]);

  async function handleFiles(files: FileList | null) {
    if (!files || !files.length || !user) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        if (file.size > 20 * 1024 * 1024) {
          toast.error(`${file.name} is larger than 20MB`);
          continue;
        }
        const path = await uploadAttachment(user.id, file);
        const url = await signedUrlFor(path, 60 * 60 * 24 * 7);
        setAttachments((current) => [
          ...current,
          {
            path,
            url,
            name: file.name,
            mediaType: file.type || "application/octet-stream",
          },
        ]);
      }
    } catch (uploadError) {
      toast.error((uploadError as Error).message);
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit(text: string) {
    const trimmed = text.trim();
    if (!trimmed && attachments.length === 0) return;
    const parts: UIMessage["parts"] = [
      ...attachments.map((attachment) => ({
        type: "file" as const,
        url: attachment.url,
        mediaType: attachment.mediaType,
        filename: attachment.name,
      })),
      ...(trimmed ? [{ type: "text" as const, text: trimmed }] : []),
    ];

    setInput("");
    setAttachments([]);

    if (!threadId) {
      onFirstMessage?.({ text: trimmed, parts });
      return;
    }
    void sendMessage({ role: "user", parts });
  }

  const empty = messages.length === 0;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Conversation className="min-h-0 flex-1">
        <ConversationContent className="mx-auto w-full max-w-3xl px-4 pb-6">
          {empty && (
            <div className="flex min-h-[55vh] flex-col items-center justify-center text-center">
              <img src={logo} alt="" width={56} height={56} className="size-14" />
              <h1 className="mt-5 font-display text-3xl font-semibold tracking-tight">
                What can I help with?
              </h1>
              <p className="mt-2 max-w-md text-sm text-muted-foreground">
                Ask anything. I can search the web, generate images, read your files and show my
                reasoning.
              </p>
              <div className="mt-8 grid w-full max-w-xl gap-2 sm:grid-cols-2">
                {SUGGESTIONS.map((suggestion) => (
                  <button
                    key={suggestion}
                    onClick={() => submit(suggestion)}
                    className="rounded-xl border border-border bg-surface px-4 py-3 text-left text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, messageIndex) => (
            <Message key={message.id} from={message.role}>
              <MessageContent className={cn(message.role === "assistant" && "bg-transparent p-0")}>
                {message.parts.map((part, partIndex) => {
                  const key = `${message.id}-${partIndex}`;

                  if (part.type === "text") {
                    return <MessageResponse key={key}>{part.text}</MessageResponse>;
                  }

                  if (part.type === "reasoning") {
                    return (
                      <Reasoning
                        key={key}
                        className="w-full"
                        isStreaming={
                          status === "streaming" &&
                          partIndex === message.parts.length - 1 &&
                          messageIndex === messages.length - 1
                        }
                      >
                        <ReasoningTrigger />
                        <ReasoningContent>{part.text}</ReasoningContent>
                      </Reasoning>
                    );
                  }

                  if (part.type === "file") {
                    return part.mediaType?.startsWith("image/") ? (
                      <img
                        key={key}
                        src={part.url}
                        alt={part.filename ?? "attachment"}
                        className="mt-2 max-h-72 rounded-xl border border-border object-contain"
                      />
                    ) : (
                      <a
                        key={key}
                        href={part.url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs hover:border-primary/40"
                      >
                        <Paperclip className="size-3.5" />
                        {part.filename ?? "file"}
                      </a>
                    );
                  }

                  if (part.type.startsWith("tool-") || part.type === "dynamic-tool") {
                    const toolPart = part as Extract<
                      UIMessage["parts"][number],
                      { type: `tool-${string}` }
                    > & { output?: unknown; input?: unknown; errorText?: string };
                    const generated =
                      toolPart.output && typeof toolPart.output === "object"
                        ? (toolPart.output as { imagePath?: string; prompt?: string })
                        : null;

                    return (
                      <div key={key} className="w-full">
                        <Tool defaultOpen={false} className="mt-2">
                          <ToolHeader type={toolPart.type} state={toolPart.state} />
                          <ToolContent>
                            <ToolInput input={toolPart.input} />
                            <ToolOutput
                              output={
                                toolPart.output ? (
                                  <pre className="whitespace-pre-wrap break-words text-xs">
                                    {JSON.stringify(toolPart.output, null, 2)}
                                  </pre>
                                ) : null
                              }
                              errorText={toolPart.errorText}
                            />
                          </ToolContent>
                        </Tool>
                        {generated?.imagePath && (
                          <SignedImage
                            path={generated.imagePath}
                            alt={generated.prompt ?? "Generated image"}
                            className="mt-3 max-h-[26rem] rounded-2xl border border-border"
                          />
                        )}
                      </div>
                    );
                  }

                  return null;
                })}
              </MessageContent>

              {message.role === "assistant" && !busy && (
                <MessageActions>
                  <MessageAction
                    label="Copy"
                    onClick={() => {
                      const text = message.parts
                        .filter((part) => part.type === "text")
                        .map((part) => (part as { text: string }).text)
                        .join("\n\n");
                      void navigator.clipboard.writeText(text);
                      toast.success("Copied");
                    }}
                  >
                    <Copy className="size-3.5" />
                  </MessageAction>
                  {messageIndex === messages.length - 1 && (
                    <MessageAction label="Regenerate" onClick={() => void regenerate()}>
                      <RefreshCw className="size-3.5" />
                    </MessageAction>
                  )}
                </MessageActions>
              )}
            </Message>
          ))}

          {status === "submitted" && (
            <div className="px-1 py-3">
              <Shimmer>Thinking...</Shimmer>
            </div>
          )}

          {error && (
            <p className="mt-3 rounded-lg border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error.message}
            </p>
          )}
        </ConversationContent>
        <ConversationScrollButton />
      </Conversation>

      <div className="mx-auto w-full max-w-3xl px-4 pb-5">
        {attachments.length > 0 && (
          <div className="mb-2 flex flex-wrap gap-2">
            {attachments.map((attachment) => (
              <span
                key={attachment.path}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs"
              >
                {attachment.mediaType.startsWith("image/") ? (
                  <ImagePlus className="size-3.5" />
                ) : (
                  <Link2 className="size-3.5" />
                )}
                <span className="max-w-40 truncate">{attachment.name}</span>
                <button
                  className="text-muted-foreground hover:text-destructive"
                  onClick={() =>
                    setAttachments((current) =>
                      current.filter((item) => item.path !== attachment.path),
                    )
                  }
                  aria-label={`Remove ${attachment.name}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <PromptInput
          onSubmit={(_message, event) => {
            event.preventDefault();
            submit(input);
          }}
        >
          <PromptInputTextarea
            ref={textareaRef}
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Message Mighty Chat…"
          />
          <PromptInputFooter>
            <PromptInputTools>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Attach files"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Paperclip className="size-4" />
                )}
              </Button>
              <input
                ref={fileRef}
                type="file"
                multiple
                accept="image/*,application/pdf,text/*"
                className="hidden"
                onChange={(event) => void handleFiles(event.target.files)}
              />
              <span className="hidden items-center gap-1 text-xs text-muted-foreground sm:inline-flex">
                <Globe className="size-3.5" /> web search & images enabled
              </span>
            </PromptInputTools>
            <PromptInputSubmit
              status={status}
              disabled={!input.trim() && attachments.length === 0 && !busy}
              onClick={busy ? () => void stop() : undefined}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
}
