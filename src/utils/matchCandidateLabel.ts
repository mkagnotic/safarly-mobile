import type { MatchCandidate } from "@/services/api";

/**
 * Mirrors web's `src/lib/matchCandidateLabel.ts`, so the two platforms cannot drift.
 *
 * How a "which delivery is this?" candidate is described to the user.
 *
 * ⚠️ The bug this exists for: a candidate is a PAIR (parcel × trip), but the picker
 * only ever rendered the PARCEL's route. When one parcel pairs with several trips
 * every row showed the same string — and for a listing that ticked "Any City" that
 * string is literally "Any → Any". The user was asked to choose between rows that
 * looked identical, and reasonably read it as the app duplicating their listing.
 *
 * So: spell "Any" out with its country, and always show the TRIP too, because the
 * trip is what differs when the parcel repeats.
 */

const COUNTRY_NAME: Record<string, string> = { IN: "India", US: "USA" };

/** "Any city, India" for a flexible end, otherwise the city itself. */
export function formatRouteEnd(
  city: string | null | undefined,
  country: string | null | undefined,
  any: boolean | undefined,
): string {
  if (any) {
    const name = country ? (COUNTRY_NAME[country.toUpperCase()] ?? country.toUpperCase()) : null;
    return name ? `Any city, ${name}` : "Any city";
  }
  return city?.trim() || "—";
}

export function formatRoute(
  fromCity: string | null | undefined, fromCountry: string | null | undefined, anyFrom: boolean | undefined,
  toCity: string | null | undefined, toCountry: string | null | undefined, anyTo: boolean | undefined,
): string {
  return `${formatRouteEnd(fromCity, fromCountry, anyFrom)} → ${formatRouteEnd(toCity, toCountry, anyTo)}`;
}

/** The parcel's route — what is being delivered. */
export function parcelRouteOf(c: MatchCandidate): string {
  return formatRoute(c.from_city, c.from_country, c.any_from, c.to_city, c.to_country, c.any_to);
}

/** The trip's route, or null when the server did not send one (older function). */
export function tripRouteOf(c: MatchCandidate): string | null {
  if (!c.trip_from_city && !c.trip_to_city && !c.trip_any_from && !c.trip_any_to) return null;
  return formatRoute(
    c.trip_from_city, c.trip_from_country, c.trip_any_from,
    c.trip_to_city, c.trip_to_country, c.trip_any_to,
  );
}

/**
 * `travel_date` is a DATE column ("2026-08-26"). `new Date("2026-08-26")` is parsed
 * as UTC and renders as the 25th for every viewer west of Greenwich, so parse it at
 * LOCAL midnight — the same rule the journey tracker uses.
 */
export function formatCandidateDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso.length <= 10 ? `${iso.slice(0, 10)}T00:00:00` : iso);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}

/**
 * Is this set of candidates actually distinguishable? Used to decide whether the
 * trip line is worth showing — and a useful guard: if every row renders the same
 * text the picker is asking an impossible question.
 */
export function candidatesAreDistinguishable(candidates: MatchCandidate[]): boolean {
  const seen = new Set(
    candidates.map((c) => `${parcelRouteOf(c)}|${tripRouteOf(c) ?? ""}|${c.travel_date ?? ""}|${c.fee_offered ?? ""}`),
  );
  return seen.size === candidates.length;
}
