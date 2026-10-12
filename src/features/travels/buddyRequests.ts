/**
 * Pure helpers for the travel-buddy request lists in My Travels -> Travel
 * Partners. Mirrors web's `src/lib/buddyRequests.ts`.
 */

const BUDDY_REQUEST_STATUS_LABEL: Readonly<Record<string, string>> = {
  pending: "Pending",
  accepted: "Accepted",
  rejected: "Declined",
  withdrawn: "Cancelled",
};

/** User-facing label for a `buddy_request_status`. 'withdrawn' is the sender's
 *  cancel, so it reads "Cancelled" — the word the Cancel button uses. Kept
 *  import-free so `node --test` can load it. */
export function buddyRequestStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return BUDDY_REQUEST_STATUS_LABEL[status] ?? status;
}

interface SentRequestLike {
  id: string;
  status: string;
  sender_id?: string | null;
}

/**
 * The sent requests that can still be cancelled: pending, sent by the viewer,
 * one row per id. The server already returns pending rows only; this keeps the
 * list honest if a stale response hands back anything else (a Cancel button on
 * an answered request would only earn a 409).
 */
export function cancellableSentRequests<T extends SentRequestLike>(
  rows: readonly T[] | null | undefined,
  viewerId: string | null | undefined,
): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows ?? []) {
    if (!r || r.status !== "pending" || seen.has(r.id)) continue;
    if (viewerId && r.sender_id && r.sender_id !== viewerId) continue;
    seen.add(r.id);
    out.push(r);
  }
  return out;
}
