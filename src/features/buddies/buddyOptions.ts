import { ANY_CITY } from "@/features/search/CityPicker";

/**
 * Option lists and validation rules shared by the buddy create screen and the
 * buddy edit modal, so the two can't drift apart the way they had.
 *
 * Every list here is verbatim web parity — see `CustomerCreateBuddy.tsx` and
 * `EditBuddyDialog.tsx`, which declare identical copies.
 */

/** Web parity (`CustomerCreateBuddy.tsx` AIRLINES). */
export const AIRLINES: readonly string[] = [
  "Air India",
  "United Airlines",
  "American Airlines",
  "Delta Air Lines",
  "Emirates",
  "Qatar Airways",
  "Etihad Airways",
  "Lufthansa",
  "British Airways",
  "Singapore Airlines",
  "Turkish Airlines",
  "KLM Royal Dutch",
  "Air France",
  "Cathay Pacific",
  "Japan Airlines",
];

/** Web parity (`CustomerCreateBuddy.tsx` LANGUAGE_OPTIONS). */
export const LANGUAGE_OPTIONS: readonly string[] = [
  "English",
  "Hindi",
  "Tamil",
  "Telugu",
  "Kannada",
  "Malayalam",
  "Bengali",
  "Marathi",
  "Gujarati",
  "Punjabi",
  "Urdu",
  "Spanish",
  "French",
  "German",
  "Mandarin",
  "Japanese",
  "Korean",
  "Arabic",
  "Portuguese",
  "Russian",
];

/** `buddy-handler` rejects payloads carrying more than this many languages. */
export const MAX_LANGUAGES = 3;

/** `buddy-handler` validates the same bounds server-side on POST and PUT. */
export const MIN_AGE = 18;
export const MAX_AGE = 120;

/** Web parity (`CustomerCreateBuddy.tsx` sameRouteMsg). */
export const SAME_ROUTE_MESSAGE = "Destination must be different from departure";
export const AGE_RANGE_MESSAGE = `Age must be between ${MIN_AGE} and ${MAX_AGE}`;

/**
 * True when departure and destination are genuinely the same place.
 *
 * `ANY_CITY` is exempt: it's a wildcard, so "Any -> Any" is a deliberately
 * broad listing rather than a mistake. Matches the rule already used by the
 * trip and parcel forms.
 */
export function isSameRoute(
  fromCountry: string,
  fromCity: string,
  toCountry: string,
  toCity: string,
): boolean {
  return (
    !!fromCity &&
    !!toCity &&
    fromCity !== ANY_CITY &&
    fromCountry === toCountry &&
    fromCity === toCity
  );
}

/**
 * Validates the optional age field. Empty is valid — age is optional — so this
 * only rejects an out-of-range number that was actually entered.
 */
export function getAgeError(age: string): string | undefined {
  if (!age) return undefined;
  const parsed = Number.parseInt(age, 10);
  if (Number.isNaN(parsed) || parsed < MIN_AGE || parsed > MAX_AGE) {
    return AGE_RANGE_MESSAGE;
  }
  return undefined;
}
