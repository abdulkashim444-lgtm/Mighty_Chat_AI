import type { UIMessage } from "ai";
import { supabase } from "@/integrations/supabase/client";

export type Thread = {
  id: string;
  title: string;
  pinned: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
};

export type StoredMessageRow = {
  id: string;
  thread_id: string;
  role: string;
  parts: unknown;
  sdk_message_id: string | null;
  created_at: string;
};

export async function listThreads(): Promise<Thread[]> {
  const { data, error } = await supabase
    .from("threads")
    .select("id,title,pinned,archived,created_at,updated_at")
    .order("pinned", { ascending: false })
    .order("updated_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as Thread[];
}

export async function createThread(title = "New chat"): Promise<Thread> {
  const { data, error } = await supabase
    .from("threads")
    .insert({ title })
    .select("id,title,pinned,archived,created_at,updated_at")
    .single();
  if (error) throw error;
  return data as Thread;
}

export async function renameThread(id: string, title: string) {
  const { error } = await supabase.from("threads").update({ title }).eq("id", id);
  if (error) throw error;
}

export async function setThreadPinned(id: string, pinned: boolean) {
  const { error } = await supabase.from("threads").update({ pinned }).eq("id", id);
  if (error) throw error;
}

export async function setThreadArchived(id: string, archived: boolean) {
  const { error } = await supabase.from("threads").update({ archived }).eq("id", id);
  if (error) throw error;
}

export async function deleteThread(id: string) {
  const { error } = await supabase.from("threads").delete().eq("id", id);
  if (error) throw error;
}

export async function getThread(id: string): Promise<Thread | null> {
  const { data, error } = await supabase
    .from("threads")
    .select("id,title,pinned,archived,created_at,updated_at")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return (data as Thread | null) ?? null;
}

export async function loadThreadMessages(threadId: string): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("messages")
    .select("id,thread_id,role,parts,sdk_message_id,created_at")
    .eq("thread_id", threadId)
    .order("created_at", { ascending: true });
  if (error) throw error;

  return ((data ?? []) as StoredMessageRow[]).map((row) => ({
    id: row.sdk_message_id ?? row.id,
    role: row.role as UIMessage["role"],
    parts: (Array.isArray(row.parts) ? row.parts : []) as UIMessage["parts"],
  }));
}

export async function deleteMessagesFrom(threadId: string, createdAt: string) {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("thread_id", threadId)
    .gte("created_at", createdAt);
  if (error) throw error;
}

export async function uploadAttachment(userId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]+/g, "_");
  const path = `${userId}/uploads/${crypto.randomUUID()}-${safeName}`;
  const { error } = await supabase.storage.from("chat-uploads").upload(path, file, {
    contentType: file.type || "application/octet-stream",
  });
  if (error) throw error;
  return path;
}

export async function signedUrlFor(path: string, expiresIn = 60 * 60) {
  const { data, error } = await supabase.storage
    .from("chat-uploads")
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}
