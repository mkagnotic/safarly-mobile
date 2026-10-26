/**
 * The viewer's local calendar day, YYYY-MM-DD.
 *
 * Sent as `today` with My Travels requests so the server ends YOUR trips, parcels
 * and buddy posts on your day, not a day late on the public UTC-minus-one rule
 * (client, 26 Oct 2026: "my trip card doesn't move to Archive"). The server only
 * honours it within one day of UTC. Web parity: src/lib/localDay.ts.
 */
export function localDay(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Adds `today` to a list request when it is one of the viewer's own (`my_*`) lists. */
export function withMyTravelsDay<T extends { filter?: string } | undefined>(params: T): T {
  if (!params?.filter?.startsWith("my_")) return params;
  return { ...params, today: localDay() } as T;
}
