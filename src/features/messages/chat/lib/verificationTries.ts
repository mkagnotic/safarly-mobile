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

export const TRAVEL_DOC_NO_TRIES_LABEL = "No tries left — ask our team to review";
export const PARCEL_NO_TRIES_LABEL = "No tries left for parcel photos";

/**
 * The pin's label + button for an upload CTA once the tries are used up: no
 * "Upload" (it opened a dead end), but the sheet still opens - it holds
 * "Request admin review" / "Cancel match" (travel doc) and "Cancel request"
 * (parcel). Null when the CTA is not an exhausted upload step.
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
