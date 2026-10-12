import type { Booking } from "@/services/api";

/**
 * Which actions the viewer may take on a booking, plus the parcel facts the
 * step copy adapts to. Pure: derived from the booking and the viewer's role.
 * Moved verbatim out of `ExpandedBody` in BookingsScreen.tsx.
 */
export function getBookingGates(booking: Booking, role: "sender" | "carrier" | "unknown") {
  // Action gates — mirror web `CustomerBookings.tsx` expanded-card rules.
  // `confirmed` is kept for back-compat with bookings the server still labels
  // that way; `awaiting_handoff` is the new post-payment status.
  const isAwaitingHandoff =
    booking.status === "awaiting_handoff" || booking.status === "confirmed";
  const canPay = booking.status === "pending_payment" && role === "sender";
  // The carrier's exit at handoff is /handoff/reject, NOT the generic cancel:
  // it asks where the parcel is and opens a return when they already hold it,
  // which a plain cancel would skip while relisting a parcel that is in
  // someone's hands. Offering both put two buttons with different server
  // consequences side by side; web has always shown only the reject here.
  const canCancel =
    booking.status === "pending_payment" || (isAwaitingHandoff && role !== "carrier");
  const canAcceptHandoff = isAwaitingHandoff && role === "carrier";
  const canRejectHandoff = canAcceptHandoff;
  // Wording only - same endpoint either way. Before the sender has sent it there
  // is no parcel to inspect, so "Can't accept this parcel" described something
  // that had not happened and carriers went looking for a "Cancel" that is not
  // theirs at this step (web parity: `HandoffActions.tsx`).
  const handoffDispatched = !!booking.handoff_dispatched_at;
  const rejectHandoffLabel = handoffDispatched
    ? "Can't accept this parcel"
    : "Cancel - I can't do this delivery";
  // Delivery code = proof of DROP-OFF, so it only appears once the parcel is
  // actually in transit (web parity, `CustomerBookings.tsx`). Offering it at
  // awaiting_handoff invited senders to hand the code to the carrier at pickup,
  // which would let the carrier close the deal and release escrow immediately.
  // Only from the moment the carrier lands (step 5). These used to show
  // throughout IN_TRANSIT so a forgotten "I've landed" tap could never strand a
  // delivery - but that put step 4 and step 6 on screen together and read as
  // being in two steps at once. Nothing is permanently blocked: the server still
  // accepts generate/confirm during in-transit, and "I've landed" is the primary
  // button on the card directly above.
  const landed = !!booking.ready_for_delivery_at;
  const canGenerateOtp = booking.status === "in_transit" && landed && role === "sender";
  const canConfirmOtp = booking.status === "in_transit" && landed && role === "carrier";
  // Possession, not altitude, decides this: under handoff-first a carrier holding
  // a paid parcel whose trip collapses BEFORE departure (payment_secured) is the
  // commonest cancellation of all.
  const canCancelPostPossession =
    ["in_transit", "payment_secured"].includes(booking.status) &&
    role === "carrier" &&
    Boolean(booking.handoff_accepted_at);
  // Stages 8/9/10 - the carrier's own journey milestones.
  const canConfirmReady =
    booking.status === "payment_secured" && role === "carrier" && !booking.ready_to_travel_at;
  const canStartJourney = booking.status === "payment_secured" && role === "carrier";
  const canMarkLanded =
    booking.status === "in_transit" && role === "carrier" && !booking.ready_for_delivery_at;
  // Report Delay stays available for the whole live journey - a carrier reaching
  // for "Cancel" because their flight slipped is how a parcel goes home for no
  // reason.
  const canReportDelay =
    ["pending_payment", "payment_secured", "in_transit"].includes(booking.status) &&
    role === "carrier" &&
    Boolean(booking.handoff_accepted_at);
  // The carrier has the parcel but has not been paid yet.
  const awaitingSenderPayment =
    booking.status === "pending_payment" && role === "carrier" && Boolean(booking.handoff_accepted_at);
  // Web parity: ratings are one-per-person-per-booking. Offer "Rate Delivery"
  // only until the viewer has rated; afterwards show a done-state chip (re-rating
  // would 409 CONFLICT server-side).
  const canRate = booking.status === "delivered" && !booking.viewer_has_rated;
  const hasRated = booking.status === "delivered" && Boolean(booking.viewer_has_rated);

  // Handoff/delivery copy adapts to the parcel: an online order is normally
  // couriered to the carrier's local address, and a return-eligible one can go
  // back to the seller instead of to the sender if declined.
  const originCity = booking.parcel?.from_city?.trim() || null;
  const destinationCity = booking.parcel?.to_city?.trim() || null;
  const isOnlineOrder = Boolean(booking.parcel?.is_online_order);
  const returnEligible = Boolean(booking.parcel?.return_eligible);

  return {
    isAwaitingHandoff,
    canPay,
    canCancel,
    canAcceptHandoff,
    canRejectHandoff,
    handoffDispatched,
    rejectHandoffLabel,
    canGenerateOtp,
    canConfirmOtp,
    canCancelPostPossession,
    canConfirmReady,
    canStartJourney,
    canMarkLanded,
    canReportDelay,
    awaitingSenderPayment,
    canRate,
    hasRated,
    originCity,
    destinationCity,
    isOnlineOrder,
    returnEligible,
  };
}
