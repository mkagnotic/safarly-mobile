/**
 * The owner's own cancelled trip (client, 2 Nov 2026). It stays in the Archive,
 * so its page still opens for the owner; say plainly that it was cancelled.
 * Same words as web (`src/lib/listingStatus.ts` cancelledTripNotice). No imports, so node tests load it. Null when
 * the trip is not cancelled.
 */
export function cancelledTripNotice(trip: {
  status?: string | null;
  deleted_at?: string | null;
  updated_at?: string | null;
}): string | null {
  if (trip.status !== "cancelled" && !trip.deleted_at) return null;
  const when = trip.deleted_at || trip.updated_at;
  const date = when
    ? new Date(when).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : null;
  return date
    ? `This trip was cancelled on ${date}. It stays in your archive so you can look back at it.`
    : "This trip was cancelled. It stays in your archive so you can look back at it.";
}
