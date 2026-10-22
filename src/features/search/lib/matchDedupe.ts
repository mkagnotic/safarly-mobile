import type { BuddySearchMatch, PackageMatch } from "@/services/api";

/** Move the deep-linked match (id === preferId) to the front so dedup keeps it
 *  as the surviving card for its person (web parity: `preferId`). */
function preferFirst<T extends { id: string }>(items: T[], preferId?: string): T[] {
  if (!preferId || !items.some((it) => it.id === preferId)) return items;
  return [...items].sort((a, b) => (a.id === preferId ? -1 : b.id === preferId ? 1 : 0));
}

/**
 * Collapse matches so each carrier/sender shows once (mirrors web). A single
 * person can list several trips on the same route + date, which otherwise
 * renders as duplicate profile cards all leading to the same chat. Keeps the
 * first (most relevant per backend ordering) match per person — or the
 * `preferId` match when set, so a deep-linked listing survives dedup.
 */
export function dedupePackageMatchesByPerson(
  matches: PackageMatch[],
  preferId?: string,
): PackageMatch[] {
  const seen = new Set<string>();
  return preferFirst(matches, preferId).filter((m) => {
    const person = m.type === "carrier_trip" ? m.carrier : m.sender;
    const key = person?.id ?? `match-${m.type}-${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** Same idea for buddy matches — one card per user. */
export function dedupeBuddyMatchesByUser(
  matches: BuddySearchMatch[],
  preferId?: string,
): BuddySearchMatch[] {
  const seen = new Set<string>();
  return preferFirst(matches, preferId).filter((m) => {
    const key = m.user?.id ?? `buddy-${m.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/** One card's worth of matches: the listing the card shows, and the same person's other listings. */
export interface PersonGroup<T> {
  primary: T;
  others: T[];
}

/**
 * One card per person, every listing kept (web parity: `groupMatchesByPerson`).
 * The dedupe above HID a person's other listings: a sender with 3 parcels on my
 * trip showed one card and the other two were unreachable (client, 22 Oct 2026).
 * Groups come out in the same order and with the same primary as the dedupe, so
 * cards, counts and paging don't move; the rest of that person's listings ride
 * along in `others`, in backend order. A match with no person id is its own group.
 */
export function groupMatchesByPerson<T extends { id: string }>(
  matches: T[],
  personKey: (m: T) => string | null | undefined,
  preferId?: string,
): PersonGroup<T>[] {
  const groups = new Map<string, PersonGroup<T>>();
  preferFirst(matches, preferId).forEach((m, i) => {
    const key = personKey(m) ?? `__no-person-${i}-${m.id}`;
    const group = groups.get(key);
    if (group) group.others.push(m);
    else groups.set(key, { primary: m, others: [] });
  });
  return [...groups.values()];
}

export const groupPackageMatchesByPerson = (matches: PackageMatch[], preferId?: string) =>
  groupMatchesByPerson(matches, (m) => (m.type === "carrier_trip" ? m.carrier : m.sender)?.id, preferId);

export const groupBuddyMatchesByUser = (matches: BuddySearchMatch[], preferId?: string) =>
  groupMatchesByPerson(matches, (m) => m.user?.id, preferId);

/** What a card's extra listings are called, by match type. Same words as web. */
const MORE_LISTING_NOUNS = {
  carrier_trip: ["trip", "trips"],
  receive_request: ["parcel", "parcels"],
  travel_buddy: ["travel buddy listing", "travel buddy listings"],
} as const;

export type MoreListingsKind = keyof typeof MORE_LISTING_NOUNS;

/**
 * The collapsed toggle under a person's card: "+2 more parcels on this route".
 * "on this route" only when every extra listing really is on the card's route -
 * a browse list can hold the same person's listings on other routes.
 */
export function moreListingsLabel(count: number, kind: MoreListingsKind, sameRoute: boolean): string {
  const [one, many] = MORE_LISTING_NOUNS[kind];
  return `+${count} more ${count === 1 ? one : many}${sameRoute ? " on this route" : ""}`;
}

/** True when every listing in `others` has the primary's from/to cities. */
export function othersShareRoute(
  primary: { from_city: string; to_city: string },
  others: { from_city: string; to_city: string }[],
): boolean {
  return others.every((o) => o.from_city === primary.from_city && o.to_city === primary.to_city);
}
