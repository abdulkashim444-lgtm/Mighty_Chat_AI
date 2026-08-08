import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import {
  Archive,
  ArchiveRestore,
  LogOut,
  MessageSquarePlus,
  Menu,
  Pencil,
  Pin,
  PinOff,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import logo from "@/assets/logo.png";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/auth";
import {
  deleteThread,
  listThreads,
  renameThread,
  setThreadArchived,
  setThreadPinned,
  type Thread,
} from "@/lib/chat-store";
import {
  deleteGuestThread,
  listGuestThreads,
  renameGuestThread,
  setGuestThreadArchived,
  setGuestThreadPinned,
} from "@/lib/guest-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      <div className="hidden w-72 shrink-0 md:block">
        <Sidebar onNavigate={() => setOpen(false)} />
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm"
            onClick={() => setOpen(false)}
          />
          <div className="relative z-10 w-72">
            <Sidebar onNavigate={() => setOpen(false)} />
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2 border-b border-border px-3 py-2 md:hidden">
          <Button variant="ghost" size="icon-sm" onClick={() => setOpen(true)} aria-label="Open menu">
            <Menu className="size-4" />
          </Button>
          <img src={logo} alt="" width={20} height={20} className="size-5" />
          <span className="font-display text-sm font-semibold">Mighty Chat</span>
        </div>
        {children}
      </div>
    </div>
  );
}

function Sidebar({ onNavigate }: { onNavigate: () => void }) {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const params = useParams({ strict: false }) as { threadId?: string };
  const [query, setQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState("");

  const guest = !user;

  const threadsQuery = useQuery({
    queryKey: ["threads", guest ? "guest" : "account"],
    queryFn: async () => (guest ? listGuestThreads() : await listThreads()),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ["threads"] });

  const mutate = useMutation({
    mutationFn: async (action: { type: string; thread: Thread; title?: string }) => {
      if (action.type === "pin") {
        if (guest) setGuestThreadPinned(action.thread.id, !action.thread.pinned);
        else await setThreadPinned(action.thread.id, !action.thread.pinned);
      }
      if (action.type === "archive") {
        if (guest) setGuestThreadArchived(action.thread.id, !action.thread.archived);
        else await setThreadArchived(action.thread.id, !action.thread.archived);
      }
      if (action.type === "delete") {
        if (guest) deleteGuestThread(action.thread.id);
        else await deleteThread(action.thread.id);
      }
      if (action.type === "rename" && action.title) {
        if (guest) renameGuestThread(action.thread.id, action.title);
        else await renameThread(action.thread.id, action.title);
      }
      return action;
    },
    onSuccess: async (action) => {
      await invalidate();
      if (action.type === "delete" && params.threadId === action.thread.id) {
        await navigate({ to: "/" });
      }
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const threads = (threadsQuery.data ?? []).filter((thread) => {
    if (showArchived !== thread.archived) return false;
    if (!query.trim()) return true;
    return thread.title.toLowerCase().includes(query.trim().toLowerCase());
  });

  return (
    <aside className="flex h-full flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground">
      <div className="flex items-center gap-2 px-4 py-4">
        <img src={logo} alt="Mighty Chat logo" width={26} height={26} className="size-[26px]" />
        <span className="font-display text-base font-semibold tracking-tight">Mighty Chat</span>
      </div>

      <div className="px-3">
        <Button
          className="w-full justify-start gap-2"
          onClick={() => {
            onNavigate();
            void navigate({ to: "/" });
          }}
        >
          <MessageSquarePlus className="size-4" />
          New chat
        </Button>
      </div>

      <div className="relative mt-3 px-3">
        <Search className="pointer-events-none absolute left-6 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search chats"
          className="border-sidebar-border bg-sidebar-accent/40 pl-9"
        />
      </div>

      <div className="mt-3 flex items-center justify-between px-4 pb-1">
        <span className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
          {showArchived ? "Archived" : "Chats"}
        </span>
        <button
          className="text-[11px] text-muted-foreground hover:text-foreground"
          onClick={() => setShowArchived(!showArchived)}
        >
          {showArchived ? "Show active" : "Show archived"}
        </button>
      </div>

      <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {threadsQuery.isLoading && (
          <div className="space-y-2 px-2 py-2">
            {[0, 1, 2, 3].map((index) => (
              <div key={index} className="h-9 animate-pulse rounded-lg bg-sidebar-accent" />
            ))}
          </div>
        )}

        {!threadsQuery.isLoading && threads.length === 0 && (
          <p className="px-3 py-6 text-sm text-muted-foreground">
            {showArchived ? "Nothing archived yet." : "No chats yet — start one above."}
          </p>
        )}

        {threads.map((thread) => {
          const active = params.threadId === thread.id;
          return (
            <div
              key={thread.id}
              className={cn(
                "group flex items-center gap-1 rounded-lg px-1 transition-colors",
                active ? "bg-sidebar-accent" : "hover:bg-sidebar-accent/60",
              )}
            >
              {editingId === thread.id ? (
                <form
                  className="flex-1 p-1"
                  onSubmit={(event) => {
                    event.preventDefault();
                    mutate.mutate({ type: "rename", thread, title: draftTitle });
                    setEditingId(null);
                  }}
                >
                  <Input
                    autoFocus
                    value={draftTitle}
                    onChange={(event) => setDraftTitle(event.target.value)}
                    onBlur={() => setEditingId(null)}
                    className="h-8"
                  />
                </form>
              ) : (
                <Link
                  to="/c/$threadId"
                  params={{ threadId: thread.id }}
                  onClick={onNavigate}
                  className="min-w-0 flex-1 truncate px-2 py-2 text-sm"
                  title={thread.title}
                >
                  {thread.pinned && <Pin className="mr-1 inline size-3 text-primary" />}
                  {thread.title}
                </Link>
              )}

              <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={thread.pinned ? "Unpin chat" : "Pin chat"}
                  onClick={() => mutate.mutate({ type: "pin", thread })}
                >
                  {thread.pinned ? <PinOff className="size-3.5" /> : <Pin className="size-3.5" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Rename chat"
                  onClick={() => {
                    setEditingId(thread.id);
                    setDraftTitle(thread.title);
                  }}
                >
                  <Pencil className="size-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label={thread.archived ? "Unarchive chat" : "Archive chat"}
                  onClick={() => mutate.mutate({ type: "archive", thread })}
                >
                  {thread.archived ? (
                    <ArchiveRestore className="size-3.5" />
                  ) : (
                    <Archive className="size-3.5" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  aria-label="Delete chat"
                  onClick={() => mutate.mutate({ type: "delete", thread })}
                >
                  <Trash2 className="size-3.5 text-destructive" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="border-t border-sidebar-border p-3">
        {guest ? (
          <div className="space-y-2">
            <p className="px-1 text-[11px] text-muted-foreground">
              Guest mode — chats are saved in this browser only.
            </p>
            <Button asChild variant="outline" size="sm" className="w-full">
              <Link to="/auth">Sign in to sync & upload files</Link>
            </Button>
          </div>
        ) : (
        <div className="flex items-center gap-2">
          <div className="bg-brand-gradient flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-primary-foreground">
            {(user?.email ?? "?").slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs text-muted-foreground">{user?.email}</p>
          </div>
          <Button variant="ghost" size="icon-sm" aria-label="Sign out" onClick={() => void signOut()}>
            <LogOut className="size-4" />
          </Button>
        </div>
        )}
      </div>
    </aside>
  );
}

export { X };
