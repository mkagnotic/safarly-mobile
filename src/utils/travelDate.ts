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

/**
 * Render a date-only `YYYY-MM-DD` column for display.
 *
 * ALWAYS use this for `travel_date`, `travel_date_from/_to`, `deadline`,
 * `delivery_by*`, `date_from/_to` — never `new Date(value)`. Those columns are
 * SQL `date`, not timestamps, so `new Date("2026-09-30")` parses as UTC
 * midnight and renders as the 29th for every user west of Greenwich. That is
 * the exact defect a client reported on 29 September 2026 ("why is the date not
 * matching for requests and the posting?"), and it survived the first fix in
 * five display formatters that were never checked.
 *
 * `new Date(value)` stays correct for TIMESTAMP columns (`created_at`,
 * `expires_at`, …) — those carry a zone and must be converted to local.
 */
export function formatLocalDate(
  value: string | null | undefined,
  opts: Intl.DateTimeFormatOptions & { locale?: string } = { month: "short", day: "numeric" },
  fallback = "—",
): string {
  const d = parseLocalDate(value);
  if (!d) return fallback;
  // `locale` defaults to the device's own. Pass it only where a screen already
  // pinned one — changing how a date READS is a separate decision from fixing
  // which DAY it shows, and this helper only owns the latter.
  const { locale, ...fmt } = opts;
  return d.toLocaleDateString(locale, fmt);
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

interface DeliveryWindowLike {
  delivery_by?: string | null;
  delivery_by_from?: string | null;
  delivery_by_to?: string | null;
}

/**
 * Parcel delivery window: "10 Sept – 18 Sept" when a range was set, otherwise
 * the single `delivery_by` date. Mirrors web's `formatDeliveryWindow`.
 */
export function formatDeliveryWindow(
  parcel: DeliveryWindowLike,
  opts?: { year?: boolean },
): string {
  const from = parcel.delivery_by_from || null;
  const to = parcel.delivery_by_to || null;
  const fmt = (d: Date) =>
    d.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      ...(opts?.year ? { year: "numeric" } : {}),
    });

  const fromDate = parseLocalDate(from);
  const toDate = parseLocalDate(to);
  if (fromDate && toDate && from !== to) {
    return `${fmt(fromDate)} – ${fmt(toDate)}`;
  }
  const single = parseLocalDate(parcel.delivery_by);
  return single ? fmt(single) : "—";
}
