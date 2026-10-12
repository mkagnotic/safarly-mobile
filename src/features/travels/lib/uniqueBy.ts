/**
 * Keep the first item for each key — guards lists against duplicate rows
 * (e.g. a buddy connection that exists twice for the same pair).
 * Web parity (`CustomerMyTrips.tsx` uniqueBy).
 */
export function uniqueBy<T>(items: T[], keyOf: (item: T) => string | undefined): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key) return true; // no usable key — leave it in rather than drop silently
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
