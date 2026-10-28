/**
 * Words for the Search filters, applied-filter chips and browse paging (28 Oct
 * 2026, one spec with web). Pure - no React Native imports - so it is unit-tested.
 */

/** Same union as `LookingForType` in searchPersistence (kept import-free for node:test). */
type LookingFor = "travel_buddy" | "carrier" | "receive_request";

/** One label per "Looking for" code - the checkbox and its chip say the same words. */
export const LOOKING_FOR_LABEL: Record<LookingFor, string> = {
  travel_buddy: "Travel buddy",
  carrier: "Carrier",
  receive_request: "Receiver requests",
};

export const ANY_CITY_CODE = "ANY";
export const ANY_CITY_TEXT = "Any city";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function parseIsoDay(iso: string): { d: number; m: number; y: number } | null {
  const hit = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!hit) return null;
  const m = Number(hit[2]);
  if (m < 1 || m > 12) return null;
  return { y: Number(hit[1]), m, d: Number(hit[3]) };
}

/**
 * "Dates: 1 Nov – 18 Nov 2026", or "Date: 1 Nov 2026" for a single day (one end
 * picked, or both the same). The year shows once unless the range crosses one.
 */
export function dateChipLabel(from?: string | null, to?: string | null): string | null {
  const a = from ? parseIsoDay(from) : null;
  const b = to ? parseIsoDay(to) : null;
  const one = a ?? b;
  if (!one) return null;
  if (!a || !b || (a.d === b.d && a.m === b.m && a.y === b.y)) {
    return `Date: ${one.d} ${MONTHS[one.m - 1]} ${one.y}`;
  }
  const start = a.y === b.y ? `${a.d} ${MONTHS[a.m - 1]}` : `${a.d} ${MONTHS[a.m - 1]} ${a.y}`;
  return `Dates: ${start} – ${b.d} ${MONTHS[b.m - 1]} ${b.y}`;
}

interface ChipFilters {
  from_city?: string;
  to_city?: string;
  date_from?: string;
  date_to?: string;
  looking_for?: string;
}

/** The applied-filter chips, in words (never raw codes like "receive_request"). */
export function filterChipLabels(filters: ChipFilters): string[] {
  const city = (c: string) => (c === ANY_CITY_CODE ? ANY_CITY_TEXT : c);
  const chips: string[] = [];
  if (filters.from_city) chips.push(`From: ${city(filters.from_city)}`);
  if (filters.to_city) chips.push(`To: ${city(filters.to_city)}`);
  const dates = dateChipLabel(filters.date_from, filters.date_to);
  if (dates) chips.push(dates);
  for (const code of filters.looking_for?.split(",").filter(Boolean) ?? []) {
    const label = LOOKING_FOR_LABEL[code as LookingFor];
    if (label) chips.push(label);
  }
  return chips;
}

/** The browse ("All listings") query for the pages on screen - web sends the same. */
export function browsePageQuery<T extends object>(
  base: T,
  pages: { carrier: number; receive: number; buddy: number },
): T & { carrier_page: number; receive_page: number; buddy_page: number } {
  return { ...base, carrier_page: pages.carrier, receive_page: pages.receive, buddy_page: pages.buddy };
}

/** "Showing 1–10 of 34 carrier trips" - web PaginationControls wording. */
export function pageRangeLabel(page: number, perPage: number, total: number, itemLabel?: string): string {
  const start = total === 0 ? 0 : (page - 1) * perPage + 1;
  const end = Math.min(page * perPage, total);
  return `Showing ${start}–${end} of ${total}${itemLabel ? ` ${itemLabel}` : ""}`;
}
