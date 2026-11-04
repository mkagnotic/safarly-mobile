/**
 * A message that arrives LIVE (realtime INSERT) carries the raw database row, and
 * a chat attachment there is a storage PATH ("<conversation>/<file>.jpg"), not a
 * link the app can load: the image showed as a black box until the chat was
 * reopened (client, 4 Nov 2026 - handoff decline photos, and any photo the other
 * side sends while the chat is open). The server signs attachments when the thread
 * is fetched, so such a row is not appended raw: the thread is refetched instead.
 * Same rule as web (useRealtimeSync: `canAppend = ... && !m.attachment_url`).
 * Pure, so it is tested without React or Supabase.
 */
export function liveRowNeedsSignedFetch(row: { attachment_url?: string | null } | null | undefined): boolean {
  const url = row?.attachment_url;
  return typeof url === "string" && url.length > 0 && !/^https?:\/\//i.test(url);
}
