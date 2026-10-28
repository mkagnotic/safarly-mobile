/**
 * When the open chat counts a message as READ (client, 28 Oct 2026: "in chat,
 * message is read but still the count shows as unread").
 *
 * Opening a thread marks it read (GET /messages). A message that arrives while the
 * chat is on screen is appended from realtime and was never marked, so the Inbox
 * tab badge counted a message the user was looking at. Same rule as web
 * (src/hooks/useRealtimeSync.ts + src/lib/activeConversation.ts): a message from
 * the OTHER side, into the open chat, while the app is in the foreground. A chat
 * left open behind a backgrounded app is not being read: it is marked when the app
 * comes back, by the thread's refetch on foreground (useResilientChannel -> GET).
 */
export function shouldMarkIncomingRead(s: {
  senderId: string | null | undefined;
  currentUserId: string | null | undefined;
  appState: string;
}): boolean {
  if (!s.senderId || !s.currentUserId) return false;
  if (s.senderId === s.currentUserId) return false;
  return s.appState === "active";
}
