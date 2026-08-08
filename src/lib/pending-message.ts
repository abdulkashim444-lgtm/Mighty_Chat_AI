import type { UIMessage } from "ai";

type Pending = { text: string; parts: UIMessage["parts"] } | null;

let pending: Pending = null;

export function setPendingMessage(value: Pending) {
  pending = value;
}

export function takePendingMessage(): Pending {
  const value = pending;
  pending = null;
  return value;
}
