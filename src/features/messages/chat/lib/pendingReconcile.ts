/**
 * Is an optimistic ("sending...") chat bubble now on the server?
 *
 * It used to be matched only by text + created_at within 60 s. Those two clocks
 * are different (the phone or browser vs the database), so a device clock that
 * was off - or a timestamp the device could not parse - left the bubble up
 * beside the real message: every message showed twice (client, 4 Nov 2026).
 * The send now returns the saved row, and the bubble remembers its id
 * (`serverId`): matched by id, exactly. The text/time match only covers the
 * moment before that reply arrives. Same rule on web and mobile.
 */
export interface PendingLike {
  text: string;
  created_at: string;
  status: string;
  serverId?: string | null;
}

export interface ServerLike {
  id: string;
  text?: string | null;
  created_at: string;
  from_user_id?: string | null;
  sender_id?: string | null;
}

export function pendingIsOnServer(p: PendingLike, server: ServerLike[], userId: string | null | undefined): boolean {
  if (p.status === "failed") return false;
  if (p.serverId) return server.some((s) => s.id === p.serverId);
  const sentAt = new Date(p.created_at).getTime();
  return server.some(
    (s) =>
      (s.from_user_id === userId || s.sender_id === userId) &&
      (s.text === p.text || (!p.text && s.text === "📎 Attachment")) &&
      Math.abs(new Date(s.created_at).getTime() - sentAt) < 60_000,
  );
}
