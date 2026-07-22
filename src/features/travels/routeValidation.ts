import { ANY_CITY } from "@/features/search/CityPicker";

/**
 * Shared route validation for the trip, parcel and buddy forms.
 *
 * The same rule had accumulated four hand-written copies (SendParcelScreen,
 * ListTripScreen, EditParcelModal, buddyOptions). They agreed, but only by
 * coincidence — the buddy edit modal shipped without the check at all, and the
 * trip edit modal still has none. One implementation removes that class of
 * drift; the message stays per-feature because the wording differs.
 */

/**
 * True when departure and destination are genuinely the same place.
 *
 * `ANY_CITY` is exempt: it's a wildcard, so "Any -> Any" is a deliberately
 * broad listing rather than a mistake. Note web does NOT exempt it and so
 * rejects that legitimate case — mobile's behaviour is the intended one.
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

/** Airline carry-on limits — the same numbers web uses (`airlineLimits.ts`). */
export const MAX_WEIGHT_KG = 23;
export const MAX_WEIGHT_LB = 50;
