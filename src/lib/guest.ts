export const GUEST_MESSAGE_LIMIT = 5;

const KEY = "mighty-guest-used";

export function guestUsed(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.localStorage.getItem(KEY);
  const value = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(value) && value > 0 ? value : 0;
}

export function guestRemaining(): number {
  return Math.max(0, GUEST_MESSAGE_LIMIT - guestUsed());
}

export function recordGuestMessage(): number {
  const next = guestUsed() + 1;
  if (typeof window !== "undefined") window.localStorage.setItem(KEY, String(next));
  return Math.max(0, GUEST_MESSAGE_LIMIT - next);
}
