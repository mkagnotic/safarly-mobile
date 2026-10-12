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
