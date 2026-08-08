import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import type { UIMessage } from "ai";
import { AppShell } from "@/components/chat/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.png";
import { useAuth } from "@/lib/auth";
import { createThread } from "@/lib/chat-store";
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

  if (!user) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-background">
        <header className="flex items-center gap-2 border-b border-border px-4 py-3">
          <img src={logo} alt="Mighty Chat logo" width={24} height={24} className="size-6" />
          <span className="font-display text-sm font-semibold">Mighty Chat</span>
          <span className="ml-2 rounded-full border border-border px-2 py-0.5 text-[11px] text-muted-foreground">
            Guest — 5 free messages
          </span>
          <div className="ml-auto">
            <Button asChild size="sm" variant="outline">
              <Link to="/auth">Sign in</Link>
            </Button>
          </div>
        </header>
        <ChatWindow threadId="guest" guest />
      </div>
    );
  }

  async function start(payload: { text: string; parts: UIMessage["parts"] }) {
    try {
      const thread = await createThread("New chat");
      setPendingMessage(payload);
      await navigate({ to: "/c/$threadId", params: { threadId: thread.id } });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  return (
    <AppShell>
      <ChatWindow threadId={null} onFirstMessage={(payload) => void start(payload)} />
    </AppShell>
  );
}
