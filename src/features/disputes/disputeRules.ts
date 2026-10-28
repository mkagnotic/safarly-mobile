/**
 * Pure dispute rules shared by the dispute screens, the chat menu, the bookings
 * card and the parcel screen. No React Native imports, so node:test can run it.
 * Wording and rules follow the 28 Oct 2026 dispute canon (same as web).
 */

/**
 * Booking statuses a dispute can be raised against. Same set as web
 * `CustomerDisputes.tsx` and the server.
 */
export const DISPUTABLE_STATUSES: ReadonlySet<string> = new Set([
  "confirmed",
  "awaiting_handoff",
  // Both post-possession: the carrier is holding the parcel, which is precisely
  // when a dispute is most likely.
  "payment_secured",
  "unpaid_return",
  "handoff_rejected",
  "in_transit",
  "delivered",
  "cancelled_post_possession",
]);

/** Description limits (server `dispute-handler/validation.ts`). */
export const MIN_DESCRIPTION = 20;
export const MAX_DESCRIPTION = 5000;
/** The counter appears once the user is this close to the cap. */
export const DESCRIPTION_COUNTER_FROM = 4500;

export const DESCRIPTION_TOO_SHORT = `Description must be at least ${MIN_DESCRIPTION} characters`;

/** Status chip labels. The server keys are never shown raw. */
export const DISPUTE_STATUS_LABELS: Record<string, string> = {
  open: "Open",
  investigating: "Under review",
  resolved: "Resolved",
  // Legacy enum value, never set today; read as the review it was.
  escalated: "Under review",
};

export function disputeStatusLabel(status: string | null | undefined): string {
  if (!status) return "";
  return DISPUTE_STATUS_LABELS[status] ?? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

interface BookingLike {
  id: string;
  status: string;
  parcel_id?: string | null;
  delivered_at?: string | null;
}

/** Product decision (28 Oct 2026): a delivered booking takes a dispute for 7 days. */
export const DELIVERED_DISPUTE_WINDOW_DAYS = 7;
export const DELIVERED_WINDOW_CLOSED_TEXT =
  "Disputes can be raised up to 7 days after delivery. Contact support if you need help.";
/** Server text for a resolved dispute (dispute-handler filing.ts), same on web. */
export const DISPUTE_CLOSED_TEXT = "This dispute is resolved, so it is closed for new messages and evidence.";

/**
 * Delivered more than 7 days ago? A delivered booking with no delivered_at is
 * left to the server to judge.
 */
export function deliveredWindowClosed(b: BookingLike, now = Date.now()): boolean {
  if (b.status !== "delivered" || !b.delivered_at) return false;
  const at = new Date(b.delivered_at).getTime();
  if (Number.isNaN(at)) return false;
  return now - at > DELIVERED_DISPUTE_WINDOW_DAYS * 24 * 60 * 60 * 1000;
}

/**
 * The bookings the file form may offer. One dispute per booking, ever, so a
 * booking that already has a dispute (including a dismissed one, and every
 * `cancelled_post_possession` booking, whose dispute the server opened
 * automatically) is left out: filing on it always fails.
 */
export function eligibleDisputeBookings<T extends BookingLike>(
  bookings: readonly T[],
  disputedBookingIds: ReadonlySet<string>,
  now = Date.now(),
): T[] {
  return bookings.filter(
    (b) =>
      DISPUTABLE_STATUSES.has(b.status) &&
      b.status !== "cancelled_post_possession" &&
      !disputedBookingIds.has(b.id) &&
      !deliveredWindowClosed(b, now),
  );
}

/** Delivered bookings past the 7-day window, shown greyed with the reason. */
export function windowClosedBookings<T extends BookingLike>(
  bookings: readonly T[],
  disputedBookingIds: ReadonlySet<string>,
  now = Date.now(),
): T[] {
  return bookings.filter((b) => !disputedBookingIds.has(b.id) && deliveredWindowClosed(b, now));
}

/**
 * The booking the form starts with: the chat's deal booking when it can be
 * disputed, otherwise nothing (the user picks). Never a booking the form
 * would refuse.
 */
export function presetDisputeBooking(
  presetId: string | null | undefined,
  eligible: readonly BookingLike[],
): string {
  if (!presetId) return "";
  return eligible.some((b) => b.id === presetId) ? presetId : "";
}

/** "4,512/5,000" near the cap, else null (same format as the chat counter). */
export function descriptionCounter(length: number): string | null {
  if (length < DESCRIPTION_COUNTER_FROM) return null;
  return `${length.toLocaleString("en-US")}/${MAX_DESCRIPTION.toLocaleString("en-US")}`;
}

export interface ServerSkippedFile {
  name: string;
  message: string;
}

/**
 * One line naming every evidence file that was not stored: the ones the client
 * screened out (its own note) and the ones the server skipped, by name.
 */
export function evidenceSkipNote(
  clientNote: string | null,
  serverSkipped: readonly ServerSkippedFile[] | null | undefined,
): string | null {
  const notes = [clientNote, ...(serverSkipped ?? []).map((f) => `${f.name}: ${f.message}`)].filter(
    (n): n is string => Boolean(n),
  );
  return notes.length ? notes.join(" ") : null;
}

/**
 * Is a dispute open on this parcel's delivery? The parcel itself never reads
 * `disputed` (only its booking does), so the banner keys off the bookings.
 */
export function parcelHasOpenDispute(parcelId: string, bookings: readonly BookingLike[]): boolean {
  return bookings.some((b) => b.parcel_id === parcelId && b.status === "disputed");
}

/** Stages where the delivery is still under way (a dismissed dispute leaves it here). */
const IN_PROGRESS_STATUSES: ReadonlySet<string> = new Set([
  "confirmed",
  "pending_payment",
  "awaiting_handoff",
  "payment_secured",
  "in_transit",
]);

export const DISPUTE_RESOLVED_CONTINUES_TEXT = "Dispute resolved — the delivery continues.";
export const DISPUTE_RESOLVED_LINK = "Dispute resolved";
export const VIEW_DISPUTE_LINK = "View dispute";

export interface BookingDisputeView {
  /** Show the "Disputed" chip (only while the dispute is open). */
  disputedChip: boolean;
  /** One-line note on the card, or null. */
  note: string | null;
  /** Link to the dispute, or null when the booking has none. */
  link: string | null;
}

interface DisputeBookingLike {
  status: string;
  dispute_status?: string | null;
}

/**
 * How a booking card shows its dispute. The fields are read defensively: an
 * older backend sends no dispute_status, and then the booking status alone
 * decides (disputed = open).
 *  - open: "Disputed" chip + "View dispute".
 *  - resolved, delivery still in progress (dismissed): the note
 *    "Dispute resolved — the delivery continues." + "View dispute".
 *  - resolved, finished (refund / release): the normal finished state + a
 *    "Dispute resolved" link.
 */
export function bookingDisputeView(b: DisputeBookingLike): BookingDisputeView {
  const ds = b.dispute_status ?? null;
  const open = ds ? ds !== "resolved" : b.status === "disputed";
  if (open) return { disputedChip: true, note: null, link: VIEW_DISPUTE_LINK };
  if (ds !== "resolved") return { disputedChip: false, note: null, link: null };
  if (IN_PROGRESS_STATUSES.has(b.status)) {
    return { disputedChip: false, note: DISPUTE_RESOLVED_CONTINUES_TEXT, link: VIEW_DISPUTE_LINK };
  }
  return { disputedChip: false, note: null, link: DISPUTE_RESOLVED_LINK };
}

/**
 * The status chip text. A booking still reading `disputed` after its dispute
 * was resolved (an older backend) says "Dispute resolved", never "Disputed".
 */
export function chipStatusLabel(b: DisputeBookingLike, normalLabel: string): string {
  if (b.status === "disputed" && !bookingDisputeView(b).disputedChip) return DISPUTE_RESOLVED_LINK;
  return normalLabel;
}
