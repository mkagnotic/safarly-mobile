import type { Booking, Trip } from "@/services/api";

/**
 * Bookings that ended before the carrier ever held the parcel. Nothing between
 * the two people is left to finish, so a block hides the trip as usual.
 */
const DEAD_BEFORE_POSSESSION = new Set(["cancelled", "expired_unpaid", "handoff_rejected"]);

/**
 * Does the viewer have a booking on this trip?
 *
 * Mirrors the exemption on ParcelDetailsScreen: a blocked person's listing is
 * hidden, EXCEPT when a delivery is already booked between the two — the
 * screen is how both sides finish it, so hiding it would strand a parcel.
 *
 * The booking list doesn't carry `trip_id` (it lives on the carrier request),
 * so a booking belongs to this trip when it is with the trip's carrier and,
 * where the booking carries its trip's dates, those dates are this trip's.
 */
export function viewerHasBookingOnTrip(
  bookings: readonly Booking[],
  trip: Pick<Trip, "carrier_id" | "user_id" | "travel_date" | "travel_date_from" | "travel_date_to"> & {
    carrier?: { id?: string } | null;
  },
  viewerId: string | null | undefined,
): boolean {
  if (!viewerId) return false;
  const carrierIds = new Set([trip.carrier_id, trip.carrier?.id, trip.user_id].filter(Boolean));
  if (carrierIds.size === 0) return false;
  return bookings.some((b) => {
    if (b.sender_id !== viewerId || !carrierIds.has(b.carrier_id)) return false;
    if (DEAD_BEFORE_POSSESSION.has(b.status)) return false;
    if (!b.trip) return true;
    return (
      (b.trip.travel_date ?? null) === (trip.travel_date ?? null) &&
      (b.trip.travel_date_from ?? null) === (trip.travel_date_from ?? null) &&
      (b.trip.travel_date_to ?? null) === (trip.travel_date_to ?? null)
    );
  });
}
