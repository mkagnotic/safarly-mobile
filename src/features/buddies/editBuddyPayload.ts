import type { BuddyListing, BuddyListingInput } from "@/services/api";
import type { EditBuddyListingFormValues } from "./EditBuddyListingModal";

/**
 * Edit buddy listing: starting values and the PUT body (28 Oct 2026 edit
 * canon, B7). My Travels and Partner details each had their own copy.
 *
 * No runtime imports, so node:test can load it: the city lists are passed in.
 * "ANY" is CityPicker's ANY_CITY sentinel (a test checks the two stay equal).
 */
const ANY_CITY = "ANY";

type Country = "IN" | "US";

export interface CityLists {
  india: readonly string[];
  usa: readonly string[];
}

const storedCountry = (c: string | null | undefined): Country | null => {
  const v = (c ?? "").trim().toUpperCase();
  return v === "IN" || v === "US" ? v : null;
};

/**
 * The country the toggle starts on: the one stored with the listing, else the
 * city's own list, else the old default (from India, to the US). An "Any" city
 * has no list, so only the stored country can keep what the user picked.
 */
export function buddyCountryOf(
  stored: string | null | undefined,
  city: string,
  lists: CityLists,
  fallback: Country,
): Country {
  const s = storedCountry(stored);
  if (s) return s;
  if (lists.india.includes(city)) return "IN";
  if (lists.usa.includes(city)) return "US";
  return fallback;
}

export type BuddyEditStored = Pick<BuddyListing, "from_city" | "to_city" | "travel_date"> &
  Partial<
    Pick<
      BuddyListing,
      | "from_country"
      | "to_country"
      | "travel_date_from"
      | "airline"
      | "age"
      | "languages"
      | "interests"
      | "layover"
      | "bio"
    >
  >;

export function buddyEditInitial(listing: BuddyEditStored, lists: CityLists): EditBuddyListingFormValues {
  return {
    from_city: listing.from_city === "Any" ? ANY_CITY : listing.from_city,
    from_country: buddyCountryOf(listing.from_country, listing.from_city, lists, "IN"),
    to_city: listing.to_city === "Any" ? ANY_CITY : listing.to_city,
    to_country: buddyCountryOf(listing.to_country, listing.to_city, lists, "US"),
    travel_date: listing.travel_date_from ?? listing.travel_date ?? "",
    airline: listing.airline ?? "",
    age: listing.age != null ? String(listing.age) : "",
    languages: listing.languages ?? [],
    interests: listing.interests ?? "",
    layover: listing.layover ?? "",
    bio: listing.bio ?? "",
  };
}

/**
 * The modal validates before this runs. buddy-handler PUT is a full upsert -
 * anything omitted is nulled - so the body stays exhaustive. The countries are
 * sent too: the server otherwise infers them from the city, and "Any" has none.
 */
export function buddyEditPayload(values: EditBuddyListingFormValues): BuddyListingInput {
  const ymd = values.travel_date.trim();
  return {
    from_city: values.from_city === ANY_CITY ? "Any" : values.from_city,
    from_country: values.from_country,
    to_city: values.to_city === ANY_CITY ? "Any" : values.to_city,
    to_country: values.to_country,
    // Single-date listing: buddy_listings has no date-mode column, so the
    // "single" case is expressed as from === to.
    travel_date: ymd,
    travel_date_from: ymd,
    travel_date_to: ymd,
    airline: values.airline.trim(),
    bio: values.bio.trim(),
    age: values.age ? Number.parseInt(values.age, 10) : undefined,
    languages: values.languages,
    interests: values.interests.trim(),
    layover: values.layover.trim(),
  };
}
