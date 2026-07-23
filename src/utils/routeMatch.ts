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
  allowAny = false,
): boolean {
  if (!filterValue || filterValue === "ANY") return true;
  if (allowAny) return true;
  const nf = normalizeLocation(filterValue);
  const nc = normalizeLocation(candidateValue);
  if (!nf || !nc) return false;
  return nc.includes(nf) || nf.includes(nc);
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
): boolean {
  const fromOk = anyFromA || anyFromB || matchesLocation(fromA ?? undefined, fromB);
  const toOk = anyToA || anyToB || matchesLocation(toA ?? undefined, toB);
  return fromOk && toOk;
}

export function parcelMatchesTrip(
  parcel: {
    from_city: string;
    to_city: string;
    any_from?: boolean;
    any_to?: boolean;
    delivery_by?: string | null;
  },
  trip: {
    from_city: string;
    to_city: string;
    any_from?: boolean;
    any_to?: boolean;
    travel_date: string;
  },
): boolean {
  if (!parcel.delivery_by) return false;
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
    ) && trip.travel_date <= parcel.delivery_by
  );
}

export function carrierTripMatchesParcel(
  trip: {
    from_city: string;
    to_city: string;
    any_from?: boolean;
    any_to?: boolean;
    travel_date?: string | null;
  },
  parcel: {
    from_city: string;
    to_city: string;
    any_from?: boolean;
    any_to?: boolean;
    delivery_by: string;
  },
): boolean {
  if (!trip.travel_date) return false;
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
    ) && trip.travel_date <= parcel.delivery_by
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
