/**
 * Client-side route-overlap helpers for the Search screen's `match_my_routes`
 * grouping. Ported byte-for-byte from
 * `web app/safarly_web/src/lib/routeMatch.ts` so a parcel/trip pair scores
 * the same on both platforms.
 */

export function normalizeLocation(value?: string | null): string {
  return (
    value
      ?.toLowerCase()
      .replace(/\([^)]*\)/g, "")
      .split(",")[0]
      .replace(/\s+/g, " ")
      .trim() ?? ""
  );
}

export function matchesLocation(
  filterValue: string | undefined,
  candidateValue: string | null | undefined,
  candidateAny = false,
  filterCountry?: string | null,
  candidateCountry?: string | null,
): boolean {
  if (!filterValue || filterValue === "ANY") return true; // no constraint asked for
  if (candidateAny) {
    return filterCountry ? sameCountry(filterCountry, candidateCountry) : true;
  }
  const nf = normalizeLocation(filterValue);
  const nc = normalizeLocation(candidateValue);
  if (!nf || !nc) return false;
  return nc.includes(nf) || nf.includes(nc);
}

/** Two ISO-3166 country codes naming the same country. Case-insensitive. */
export function sameCountry(a?: string | null, b?: string | null): boolean {
  if (!a || !b) return false;
  return a.trim().toUpperCase() === b.trim().toUpperCase();
}

/** One end of a route: the city, the country it sits in, and whether the owner
 *  declared themselves flexible about the city. */
export interface RouteEnd {
  city?: string | null;
  country?: string | null;
  any?: boolean;
}

/**
 * Do two route ENDS meet?
 *
 * ⚠️ Replaces `anyFromA || anyFromB || cityMatch(...)`, which was the bug: either
 * side ticking "Any" satisfied the axis unconditionally, so a listing flexible on
 * BOTH ends matched every listing in the database regardless of route.
 *
 * "Any" means *any city inside the country the owner already selected*, never
 * "anywhere on earth", so once either side is flexible the countries carry the
 * match. `from_country` / `to_country` are NOT NULL in the schema; an unknown
 * country still falls back to permissive so a caller that fails to SELECT it does
 * not silently lose every flexible listing.
 */
export function endsMeet(a: RouteEnd, b: RouteEnd): boolean {
  if (a.any || b.any) {
    if (!a.country || !b.country) return true; // cannot bound what we cannot see
    return sameCountry(a.country, b.country);
  }
  return matchesLocation(a.city ?? undefined, b.city);
}

export function routesOverlap(
  fromA: string | null | undefined,
  toA: string | null | undefined,
  anyFromA: boolean,
  anyToA: boolean,
  fromB: string | null | undefined,
  toB: string | null | undefined,
  anyFromB: boolean,
  anyToB: boolean,
  /** Countries for each end. Optional so existing callers keep compiling, but
   *  passing them is what bounds "Any" to a country. */
  countries?: {
    fromCountryA?: string | null; toCountryA?: string | null;
    fromCountryB?: string | null; toCountryB?: string | null;
  },
): boolean {
  const fromOk = endsMeet(
    { city: fromA, country: countries?.fromCountryA, any: anyFromA },
    { city: fromB, country: countries?.fromCountryB, any: anyFromB },
  );
  const toOk = endsMeet(
    { city: toA, country: countries?.toCountryA, any: anyToA },
    { city: toB, country: countries?.toCountryB, any: anyToB },
  );
  return fromOk && toOk;
}

/** True when two inclusive [start,end] date windows overlap. Either side may be a
 *  single date (only one bound provided). */
export function dateRangesOverlap(
  startA: string | null | undefined, endA: string | null | undefined,
  startB: string | null | undefined, endB: string | null | undefined,
): boolean {
  const aStart = startA || endA;
  const aEnd = endA || startA;
  const bStart = startB || endB;
  const bEnd = endB || startB;
  if (!aStart || !aEnd || !bStart || !bEnd) return false;
  return aStart <= bEnd && bStart <= aEnd;
}

/**
 * Does the trip's travel window overlap the parcel's delivery window?
 *
 * ⚠️ This used to be `trip.travel_date <= parcel.delivery_by` — a deadline test with
 * NO lower bound, so mobile matched trips departing long before the sender's earliest
 * acceptable date and showed matches web and the server would never make. The parcel's
 * window is `[delivery_by_from, delivery_by_to || delivery_by]`; every parcel in the
 * database carries both bounds.
 */
function datesMatch(
  trip: { travel_date?: string | null; travel_date_from?: string | null; travel_date_to?: string | null },
  parcel: { delivery_by?: string | null; delivery_by_from?: string | null; delivery_by_to?: string | null },
): boolean {
  const tripStart = trip.travel_date_from || trip.travel_date;
  const tripEnd = trip.travel_date_to || trip.travel_date;
  const parcelStart = parcel.delivery_by_from || parcel.delivery_by;
  const parcelEnd = parcel.delivery_by_to || parcel.delivery_by;
  if (!tripStart || !parcelEnd) return false;
  return dateRangesOverlap(tripStart, tripEnd, parcelStart, parcelEnd);
}

export function parcelMatchesTrip(
  parcel: {
    from_city: string;
    to_city: string;
    from_country?: string | null;
    to_country?: string | null;
    any_from?: boolean;
    any_to?: boolean;
    delivery_by?: string | null;
    delivery_by_from?: string | null;
    delivery_by_to?: string | null;
  },
  trip: {
    from_city: string;
    to_city: string;
    from_country?: string | null;
    to_country?: string | null;
    any_from?: boolean;
    any_to?: boolean;
    travel_date: string;
    travel_date_from?: string | null;
    travel_date_to?: string | null;
  },
): boolean {
  return (
    routesOverlap(
      trip.from_city,
      trip.to_city,
      !!trip.any_from,
      !!trip.any_to,
      parcel.from_city,
      parcel.to_city,
      !!parcel.any_from,
      !!parcel.any_to,
      {
        fromCountryA: trip.from_country, toCountryA: trip.to_country,
        fromCountryB: parcel.from_country, toCountryB: parcel.to_country,
      },
    ) && datesMatch(trip, parcel)
  );
}

export function carrierTripMatchesParcel(
  trip: {
    from_city: string;
    to_city: string;
    from_country?: string | null;
    to_country?: string | null;
    any_from?: boolean;
    any_to?: boolean;
    travel_date?: string | null;
    travel_date_from?: string | null;
    travel_date_to?: string | null;
  },
  parcel: {
    from_city: string;
    to_city: string;
    from_country?: string | null;
    to_country?: string | null;
    any_from?: boolean;
    any_to?: boolean;
    delivery_by: string;
    delivery_by_from?: string | null;
    delivery_by_to?: string | null;
  },
): boolean {
  return (
    routesOverlap(
      parcel.from_city,
      parcel.to_city,
      !!parcel.any_from,
      !!parcel.any_to,
      trip.from_city,
      trip.to_city,
      !!trip.any_from,
      !!trip.any_to,
      {
        fromCountryA: parcel.from_country, toCountryA: parcel.to_country,
        fromCountryB: trip.from_country, toCountryB: trip.to_country,
      },
    ) && datesMatch(trip, parcel)
  );
}

/** Show-but-flag helper: the parcel is heavier than the carrier's capacity. */
export function parcelExceedsCapacity(
  weightKg: number | null | undefined,
  capacityKg: number | null | undefined,
): boolean {
  if (weightKg == null || capacityKg == null) return false;
  return Number(weightKg) > Number(capacityKg);
}
