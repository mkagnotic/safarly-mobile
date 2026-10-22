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

/**
 * Label for the locked "confirm journey" chip on a buddy connection whose trip
 * hasn't started yet. Journey confirmation is deliberately locked until the
 * trip's start date (buddy-handler refuses an early completion), so the chip
 * names the day it unlocks rather than a bare "Confirm after trip". The
 * formatter is passed in so this module stays import-free for `node --test`.
 */
export function confirmJourneyLockedLabel(
  journeyStart: string | null | undefined,
  formatDate: (ymd: string) => string,
): string {
  const ymd = journeyStart ? journeyStart.slice(0, 10) : "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return "Confirm after trip";
  const label = formatDate(ymd);
  return label && label !== "—" ? `Confirm journey from ${label}` : "Confirm after trip";
}

/** Shown under the locked chip so it reads as "not yet", not "broken". */
export const CONFIRM_JOURNEY_LOCKED_HINT = "You can confirm your journey once your trip has started.";
