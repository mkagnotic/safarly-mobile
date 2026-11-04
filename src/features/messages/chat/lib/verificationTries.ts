/**
 * Tries left at the two upload steps, and what the pin shows when they are
 * used up (chat spec, 28 Oct 2026, bugs 4 and 5). The server's CTA code stays
 * `upload_*` (installed apps still open the sheet), and older servers still say
 * "Upload ...", so the app decides from the tries itself - never from the label.
 *
 * Pure (no React Native imports) so node:test can load it.
 */

export function triesLeft(attempts: number | null | undefined, maxAttempts: number | null | undefined, fallbackMax: number): number {
  const max = maxAttempts ?? fallbackMax;
  return Math.max(0, max - (attempts ?? 0));
}

export interface TriesState {
  status?: string | null;
  attempts?: number | null;
  max_attempts?: number | null;
}

/** The carrier's travel document: rejected and no tries left (3 by default). */
export function travelDocOutOfTries(doc: TriesState | null | undefined): boolean {
  if (!doc || doc.status !== "rejected") return false;
  return triesLeft(doc.attempts, doc.max_attempts, 3) === 0;
}

/** The sender's parcel photos: not under review / approved, and no tries left (5 by default). */
export function parcelOutOfTries(review: TriesState | null | undefined): boolean {
  if (!review || review.status === "pending" || review.status === "approved") return false;
  return triesLeft(review.attempts, review.max_attempts, 5) === 0;
}

export const TRAVEL_DOC_NO_TRIES_LABEL = "No tries left for the travel document";
export const PARCEL_NO_TRIES_LABEL = "No tries left for parcel photos";

/**
 * The pin's label + button for an upload CTA once the tries are used up: no
 * "Upload" (it opened a dead end), but the sheet still opens - it holds
 * "Cancel match" (travel doc) and "Cancel request" (parcel). Since the
 * auto-unmatch change (client, 3 Nov 2026) the server ends the deal on the
 * final rejection, so this only shows for a deal that ran out before that. Null when the CTA is not an exhausted upload step.
 */
export function outOfTriesCta(
  code: string,
  state: { travelDoc?: TriesState | null; parcelReview?: TriesState | null },
): { label: string; button: string } | null {
  if (code === "upload_travel_doc" && travelDocOutOfTries(state.travelDoc)) {
    return { label: TRAVEL_DOC_NO_TRIES_LABEL, button: "Open" };
  }
  if (code === "upload_parcel_photos" && parcelOutOfTries(state.parcelReview)) {
    return { label: PARCEL_NO_TRIES_LABEL, button: "Open" };
  }
  return null;
}

/**
 * The pending upload is the uploader's LAST try: rejecting it ends the match
 * automatically (client-approved, 3 Nov 2026 - the server unmatches on the final
 * rejection). `attempts` counts uploads, so a pending upload with
 * attempts >= max is the last one. Older servers omit max_attempts on parcel
 * review: the fallback (3 travel doc, 5 parcel) matches the server.
 */
export function isLastTry(state: TriesState | null | undefined, fallbackMax: number): boolean {
  if (!state || state.status !== "pending") return false;
  return (state.attempts ?? 0) >= (state.max_attempts ?? fallbackMax);
}

/** Shown above the reject confirm button on the last try. Web carries the identical line. */
export const LAST_TRY_REJECT_WARNING = "This was their last try. Rejecting it will end this match automatically.";
/** The reject form's confirm button on the last try (3 Nov 2026): it ends the match, so it says so. Same words on web. */
export const LAST_TRY_REJECT_BUTTON = "Reject and end match";

/** Toast after a reject that ended the match (`auto_unmatched: true`). Web parity. */
export const AUTO_UNMATCHED_TOAST = "This match has ended automatically.";

/**
 * Did the reject end the match? The reject endpoints return `auto_unmatched: true`
 * when the server unmatched the deal; older servers never send it (false).
 */
export function rejectEndedMatch(data: unknown): boolean {
  return !!data && typeof data === "object" && (data as { auto_unmatched?: unknown }).auto_unmatched === true;
}
