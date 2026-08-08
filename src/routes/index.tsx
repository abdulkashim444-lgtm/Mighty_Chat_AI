import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { AppShell } from "@/components/chat/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuth } from "@/lib/auth";
import { createThread } from "@/lib/chat-store";
import { createGuestThread } from "@/lib/guest-store";
import { setPendingMessage } from "@/lib/pending-message";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Mighty Chat — AI assistant with search, images & reasoning" },
      {
        name: "description",
        content:
          "Start a new chat with Mighty Chat: live web search, image generation, file understanding and visible reasoning in one assistant.",
      },
      { property: "og:title", content: "Mighty Chat — AI assistant with search & images" },
      {
        property: "og:description",
        content:
          "A powerful AI chat assistant with live web search, image generation, file uploads and visible reasoning.",
      },
    ],
  }),
  component: Index,
});

function Index() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    );
  }

  async function start(payload: { text: string; parts: UIMessage["parts"] }) {
    try {
      const thread = user ? await createThread("New chat") : createGuestThread("New chat");
      setPendingMessage(payload);
      await navigate({ to: "/c/$threadId", params: { threadId: thread.id } });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <AppShell>
      <ChatWindow threadId={null} guest={!user} onFirstMessage={(payload) => void start(payload)} />
    </AppShell>
  );
}
