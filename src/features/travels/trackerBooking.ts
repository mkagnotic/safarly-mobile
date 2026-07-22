import type { Booking, Parcel } from "@/services/api";

/**
 * Resolves which booking drives a parcel's journey tracker.
 *
 * Extracted so My Travels and the parcel details screen can't disagree about
 * which booking a parcel's timeline reflects. Web parity
 * (`CustomerMyTrips.tsx` BOOKING_PROGRESS_RANK / trackerBookingFor).
 */

// How far a booking has progressed — higher wins when a parcel has several
// bookings (multi-bidder). Failed/terminal bookings rank 0 and are ignored so
// the tracker follows the live booking, not a stale cancelled bid.
const BOOKING_PROGRESS_RANK: Record<string, number> = {
  pending_payment: 1,
  confirmed: 2,
  awaiting_handoff: 3,
  in_transit: 4,
  delivered: 5,
};

export const bookingRank = (b: Booking): number => BOOKING_PROGRESS_RANK[b.status] ?? 0;

// Parcel statuses that mean "still looking for a carrier" — resolve to no
// booking so the tracker reads as awaiting, not as a stale cancelled bid.
const AWAITING_CARRIER = new Set(["open", "looking_for_match", "match_requested", "chatting"]);

/**
 * Builds a lookup from a flat booking list.
 *
 * Prefers the most-progressed *active* booking; if there's none and the parcel
 * isn't back to searching, falls back to the latest booking so a terminal
 * (cancelled) or disputed journey still renders its real state.
 *
 * @param myUserId when given, only bookings where this user is the sender count
 *   — matches web, which filters the sender-scoped list before resolving.
 */
export function createTrackerBookingResolver(
  bookings: Booking[],
  myUserId?: string | null,
): (parcel: Parcel) => Booking | null {
  const activeByParcelId = new Map<string, Booking>();
  const latestByParcelId = new Map<string, Booking>();

  for (const b of bookings) {
    if (myUserId && b.sender_id !== myUserId) continue;
    const latest = latestByParcelId.get(b.parcel_id);
    if (!latest || b.created_at > latest.created_at) latestByParcelId.set(b.parcel_id, b);
    if (bookingRank(b) > 0) {
      const active = activeByParcelId.get(b.parcel_id);
      if (!active || bookingRank(b) > bookingRank(active)) {
        activeByParcelId.set(b.parcel_id, b);
      }
    }
  }

  return (parcel: Parcel): Booking | null =>
    activeByParcelId.get(parcel.id) ??
    (AWAITING_CARRIER.has(parcel.status) ? null : latestByParcelId.get(parcel.id) ?? null);
}
