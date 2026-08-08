import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useCallback, useMemo } from "react";
import type { UIMessage } from "ai";
import { AppShell } from "@/components/chat/AppShell";
import { ChatWindow } from "@/components/chat/ChatWindow";
import { useAuth } from "@/lib/auth";
import { loadThreadMessages } from "@/lib/chat-store";
import { loadGuestMessages, saveGuestMessages } from "@/lib/guest-store";
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
  const guest = !user;
  const pending = useMemo(() => takePendingMessage(), [threadId]);

  const messagesQuery = useQuery({
    queryKey: ["messages", threadId, guest ? "guest" : "account"],
    queryFn: async () => (guest ? loadGuestMessages(threadId) : await loadThreadMessages(threadId)),
    enabled: !loading,
    staleTime: Infinity,
  });

  const persistGuest = useCallback(
    (messages: UIMessage[]) => {
      if (messages.length) saveGuestMessages(threadId, messages);
    },
    [threadId],
  );

  if (loading || messagesQuery.isLoading) {
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
        guest={guest}
        {...(guest ? { onMessagesChange: persistGuest } : {})}
      />
    </AppShell>
  );
}
