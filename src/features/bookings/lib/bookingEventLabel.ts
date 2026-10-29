/**
 * A booking timeline event in plain words (27 Oct 2026): the raw code
 * ("handoff_accepted", "payment_held") used to be shown with "_" swapped for
 * spaces. Twin of the other app's copy - keep the two identical.
 */
const EVENT_LABELS: Record<string, string> = {
  match_requested: "Request sent",
  match_confirmed: "Match confirmed",
  match_declined: "Request declined",
  unmatched: "Unmatched",
  auto_unmatched: "Match ended automatically",
  travel_date_confirmed: "Travel date confirmed",
  handoff_dispatched: "Parcel sent to the carrier",
  handoff_accepted: "Carrier accepted the parcel",
  handoff_rejected: "Carrier declined the parcel",
  payment_required: "Payment requested",
  payment_pending: "Waiting for payment",
  payment_held: "Payment received",
  payment_released: "Payout released to the carrier",
  payment_refunded: "Payment refunded",
  payment_disputed: "Payment disputed",
  payout_frozen: "Payout on hold",
  ready_to_travel: "Ready to travel",
  journey_started: "Journey started",
  journey_delayed: "Journey delayed",
  ready_for_delivery: "Ready for delivery",
  otp_generated: "Delivery code created",
  delivered: "Delivered",
  admin_verified_delivery: "Delivery confirmed by Safarly",
  cancelled: "Cancelled",
  parcel_cancelled: "Parcel cancelled",
  parcel_return_opened: "Return started",
  return_resolution_set: "Return plan agreed",
  return_received: "Return received",
  return_completed: "Return completed",
  dispute_resolved: "Dispute resolved",
};

/** "some_code" -> "Some code": the fallback for anything not listed above. */
export function humaniseCode(code: string | null | undefined): string {
  const s = String(code ?? "").replace(/_/g, " ").trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : "";
}

export function bookingEventLabel(event: string | null | undefined): string {
  return (event && EVENT_LABELS[event]) || humaniseCode(event);
}

/**
 * Booking statuses in plain words, one list for both apps. "Handoff" read
 * backwards to a carrier, who receives the parcel - "handover" works for both
 * sides (27 Oct 2026).
 */
export const BOOKING_STATUS_LABELS: Record<string, string> = {
  pending_payment: "Pending payment",
  expired_unpaid: "Expired",
  confirmed: "Confirmed",
  awaiting_handoff: "Handover pending",
  handoff_rejected: "Declined at handover",
  payment_secured: "Ready to travel",
  unpaid_return: "Unpaid - parcel returning",
  in_transit: "In transit",
  delivered: "Delivered",
  cancelled: "Cancelled",
  cancelled_post_possession: "Cancelled mid-trip",
  disputed: "Disputed",
};

export function bookingStatusLabel(status: string | null | undefined): string {
  return (status && BOOKING_STATUS_LABELS[status]) || humaniseCode(status);
}
