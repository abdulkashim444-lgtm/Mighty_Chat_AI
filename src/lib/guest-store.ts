import type { UIMessage } from "ai";
import type { Thread } from "@/lib/chat-store";

const THREADS_KEY = "mighty-guest-threads";
const MESSAGES_PREFIX = "mighty-guest-messages:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* storage full or unavailable */
  }
}

function saveThreads(threads: Thread[]) {
  write(THREADS_KEY, threads);
}

function allThreads(): Thread[] {
  return read<Thread[]>(THREADS_KEY, []);
}

export function listGuestThreads(): Thread[] {
  return allThreads().sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updated_at.localeCompare(a.updated_at);
  });
}

export function createGuestThread(title = "New chat"): Thread {
  const now = new Date().toISOString();
  const thread: Thread = {
    id: crypto.randomUUID(),
    title,
    pinned: false,
    archived: false,
    created_at: now,
    updated_at: now,
  };
  saveThreads([thread, ...allThreads()]);
  return thread;
}

export function getGuestThread(id: string): Thread | null {
  return allThreads().find((thread) => thread.id === id) ?? null;
}

function updateGuestThread(id: string, patch: Partial<Thread>) {
  saveThreads(
    allThreads().map((thread) =>
      thread.id === id ? { ...thread, ...patch, updated_at: new Date().toISOString() } : thread,
    ),
  );
}

export function renameGuestThread(id: string, title: string) {
  updateGuestThread(id, { title });
}

export function setGuestThreadPinned(id: string, pinned: boolean) {
  updateGuestThread(id, { pinned });
}

export function setGuestThreadArchived(id: string, archived: boolean) {
  updateGuestThread(id, { archived });
}

export function deleteGuestThread(id: string) {
  saveThreads(allThreads().filter((thread) => thread.id !== id));
  if (typeof window !== "undefined") window.localStorage.removeItem(MESSAGES_PREFIX + id);
}

export function loadGuestMessages(threadId: string): UIMessage[] {
  return read<UIMessage[]>(MESSAGES_PREFIX + threadId, []);
}

export function saveGuestMessages(threadId: string, messages: UIMessage[]) {
  write(MESSAGES_PREFIX + threadId, messages);

  const thread = getGuestThread(threadId);
  if (!thread) return;

  const patch: Partial<Thread> = {};
  if (thread.title === "New chat") {
    const firstUser = messages.find((message) => message.role === "user");
    const text = firstUser?.parts
      .filter((part) => part.type === "text")
      .map((part) => (part as { text: string }).text)
      .join(" ")
      .trim();
    if (text) patch.title = text.length > 60 ? `${text.slice(0, 57)}…` : text;
  }
  updateGuestThread(threadId, patch);
}
