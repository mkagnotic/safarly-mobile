/**
 * Handoff rejection photos (3 Nov 2026): the carrier who declines a parcel at
 * inspection can attach up to 5 photos, and BOTH parties see them on the
 * booking. Was one optional photo the receiver never saw. Same words as web.
 *
 * Kept free of app runtime imports so the node test runner can exercise it.
 */

/** The most photos a carrier can attach to a handoff decline (server: 5). */
export const HANDOFF_PHOTOS_MAX = 5;

export const ADD_PHOTOS_LABEL = "Add photos (up to 5)";
export const PHOTO_LIMIT_MESSAGE = "You can add up to 5 photos.";
export const UPLOADING_PHOTOS = "Uploading photos…";
export const CARRIERS_PHOTOS_TITLE = "Carrier's photos";

/** "2/5" under the thumbnails. */
export function photoCounter(count: number): string {
  return `${Math.max(0, Math.min(count, HANDOFF_PHOTOS_MAX))}/${HANDOFF_PHOTOS_MAX}`;
}

/** How many more photos fit - the picker's `selectionLimit`. Never below 0. */
export function remainingPhotoSlots(count: number): number {
  return Math.max(0, HANDOFF_PHOTOS_MAX - Math.max(0, count));
}

/**
 * Append freshly picked photos, keeping at most 5. `overflow` is true when some
 * were dropped (a picker that ignored `selectionLimit`) - say so, never drop
 * silently.
 */
export function addPhotos<T>(current: readonly T[], picked: readonly T[]): { photos: T[]; overflow: boolean } {
  const room = remainingPhotoSlots(current.length);
  const taken = picked.slice(0, room);
  return { photos: [...current, ...taken], overflow: picked.length > taken.length };
}

/** Remove the photo at `index` (the thumbnail's ×). */
export function removePhotoAt<T>(photos: readonly T[], index: number): T[] {
  return photos.filter((_, i) => i !== index);
}

export interface RejectHandoffBody {
  reason: string;
  parcel_with_carrier: boolean;
  /** New backend: every uploaded photo (max 5). */
  photo_paths?: string[];
  /** Old backend: reads one photo only - the first. */
  photo_path?: string;
}

/**
 * The reject request: `photo_paths` for the new backend AND `photo_path` (the
 * first) so an older backend still records one. No photos: neither field.
 */
export function rejectHandoffBody(reason: string, withCarrier: boolean, paths: readonly string[]): RejectHandoffBody {
  const photoPaths = paths.filter((p) => typeof p === "string" && p.length > 0).slice(0, HANDOFF_PHOTOS_MAX);
  const body: RejectHandoffBody = { reason, parcel_with_carrier: withCarrier };
  if (photoPaths.length > 0) {
    body.photo_paths = photoPaths;
    body.photo_path = photoPaths[0];
  }
  return body;
}

/**
 * The signed photo URLs on a declined booking. New backend: the
 * `handoff_rejection_proof_urls` array; old backend: only the single
 * `handoff_rejection_proof_url`. Empties and duplicates are dropped.
 */
export function rejectionPhotoUrls(
  booking:
    | {
        handoff_rejection_proof_urls?: readonly (string | null | undefined)[] | null;
        handoff_rejection_proof_url?: string | null;
      }
    | null
    | undefined,
): string[] {
  if (!booking) return [];
  const list = Array.isArray(booking.handoff_rejection_proof_urls)
    ? booking.handoff_rejection_proof_urls
    : [booking.handoff_rejection_proof_url];
  const out: string[] = [];
  for (const u of list) {
    if (typeof u === "string" && u.trim() && !out.includes(u)) out.push(u);
  }
  return out.slice(0, HANDOFF_PHOTOS_MAX);
}

/** "Carrier's photo 1 of 3" - each thumbnail's accessibility label. */
export function rejectionPhotoA11yLabel(index: number, total: number): string {
  return `Carrier's photo ${index + 1} of ${total}`;
}
