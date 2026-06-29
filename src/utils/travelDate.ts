/**
 * Travel-date helpers shared across trip / buddy cards and detail screens.
 *
 * A trip or buddy listing carries three date columns: `travel_date` (departure),
 * `travel_date_from` (= departure), and `travel_date_to` (return; equals the
 * departure for a single-date listing). These helpers render that correctly.
 */

/** Parse a `YYYY-MM-DD` string as a LOCAL date (avoids the UTC off-by-one). */
export function parseLocalDate(s?: string | null): Date | null {
  if (!s) return null;
  const [y, m, d] = String(s).split("-").map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

interface TravelDateLike {
  travel_date?: string | null;
  travel_date_from?: string | null;
  travel_date_to?: string | null;
}

/**
 * "10 Sept" for a single date, "10 Sept – 18 Sept" for a range. Falls back to
 * `travel_date` so legacy single-date rows still render as one date.
 */
export function formatTravelDateRange(
  item: TravelDateLike,
  opts?: { year?: boolean },
): string {
  const from = item.travel_date_from || item.travel_date || null;
  const to = item.travel_date_to || item.travel_date || null;
  const fromDate = parseLocalDate(from);
  if (!fromDate) return "—";

  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(opts?.year ? { year: "numeric" } : {}),
    });

  const fromLabel = fmt(fromDate);
  if (!to || from === to) return fromLabel;
  const toDate = parseLocalDate(to);
  return toDate ? `${fromLabel} – ${fmt(toDate)}` : fromLabel;
}
