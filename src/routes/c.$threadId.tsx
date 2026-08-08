import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";
import { AppShell } from "@/components/chat/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuth } from "@/lib/auth";
import { loadThreadMessages } from "@/lib/chat-store";
import { takePendingMessage } from "@/lib/pending-message";

export const Route = createFileRoute("/c/$threadId")({
  head: () => ({
    meta: [
      { title: "Conversation — Mighty Chat" },
      {
        name: "description",
        content:
          "Continue your conversation in Mighty Chat with web search, image generation and visible reasoning.",
      },
      { property: "og:title", content: "Conversation — Mighty Chat" },
      {
        property: "og:description",
        content: "Continue your AI conversation with search, images and visible reasoning.",
      },
    ],
  }),
  component: ThreadPage,
});

function ThreadPage() {
  const { threadId } = Route.useParams();
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const pending = useMemo(() => takePendingMessage(), [threadId]);

  useEffect(() => {
    if (!loading && !user) void navigate({ to: "/auth" });
  }, [user, loading, navigate]);

  const messagesQuery = useQuery({
    queryKey: ["messages", threadId],
    queryFn: () => loadThreadMessages(threadId),
    enabled: Boolean(user),
    staleTime: Infinity,
  });

  if (loading || !user || messagesQuery.isLoading) {
    return (
      <AppShell>
        <div className="flex flex-1 items-center justify-center">
          <div className="size-8 animate-spin rounded-full border-2 border-border border-t-primary" />
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <ChatWindow
        key={threadId}
        threadId={threadId}
        initialMessages={messagesQuery.data ?? []}
        autoSend={pending}
      />
    </AppShell>
  );
}
