/**
 * "Open to being a travel buddy" on List Trip / Edit Trip - one wording for
 * web, Android and iOS (27 Oct 2026). Pure, so it is unit-tested.
 */

/** What trip-handler reports about the buddy listing it made (or didn't). */
export type BuddyListingResult = "created" | "existing" | "failed" | null;

export const OPEN_BUDDY_LABEL = "I'm also open to being a travel buddy on this trip";
export const OPEN_BUDDY_HELPER =
  "We'll also create a buddy listing in Travel Partners, so travelers on this route can find you and start a chat.";
export const OPEN_BUDDY_OFF_HELPER = "Turning this off removes your buddy listing for this trip.";
export const BUDDY_AGE_HINT = "Between 18 and 120.";
export const BUDDY_AGE_ERROR = "Age must be between 18 and 120.";
export const BUDDY_LANGUAGE_CAP = "You can choose up to 3 languages.";
export const BUDDY_TEXT_MAX = 1000;

/** Empty is fine (age is optional); otherwise a whole number 18-120, as the server checks. */
export function buddyAgeError(age: string): string | null {
  const v = age.trim();
  if (v === "") return null;
  const n = Number(v);
  return Number.isInteger(n) && n >= 18 && n <= 120 ? null : BUDDY_AGE_ERROR;
}

/** Sentence appended to the List Trip success line; "" when no buddy listing was asked for. */
export function listTripBuddySentence(result: BuddyListingResult | undefined): string {
  switch (result) {
    case "created":
      return " We also created your buddy listing — find it in My Travels → Travel Partners.";
    case "existing":
      return " You already had a buddy listing for this route — it's in My Travels → Travel Partners.";
    case "failed":
      return " We couldn't create your buddy listing this time — you can add one from My Travels → Travel Partners.";
    default:
      return "";
  }
}

/**
 * Message after saving Edit Trip. `changedTo` is the new toggle value when the
 * user changed it, else undefined. Null = nothing buddy-related to say.
 */
export function editTripBuddyMessage(
  changedTo: boolean | undefined,
  result: BuddyListingResult | undefined,
): { text: string; variant: "success" | "warning" } | null {
  if (changedTo === false) return { text: "Your buddy listing for this trip was removed.", variant: "success" };
  switch (result) {
    case "created":
      return { text: "Your buddy listing is live in Travel Partners.", variant: "success" };
    case "existing":
      return { text: "You already have a buddy listing for this route.", variant: "success" };
    case "failed":
      return { text: "Trip saved, but we couldn't create your buddy listing. Try again later.", variant: "warning" };
    default:
      return null;
  }
}
