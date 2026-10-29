/**
 * What the booking actions SAY about money. Pure, so the rules are tested:
 * every line follows what the server actually did, never what we hope it did.
 *
 *  - "refunded" only when money came back; otherwise "not charged".
 *  - A carrier penalty is "taken from your next payout"; a waiver cancels it.
 *  - Once the carrier holds the parcel, ending the deal means it has to come back.
 *
 * Same words as web (money canon, 28 Oct 2026).
 */

/** The money consequence line under "Cancel this booking?". */
export function cancelMoneyLine(
  booking: { handoff_accepted_at?: string | null; payment_made?: boolean | null },
  isSender: boolean,
): string {
  const refund = isSender ? "You'll be refunded in full." : "The sender will be refunded in full.";
  if (booking.handoff_accepted_at) {
    return booking.payment_made
      ? `The parcel is already with the carrier, so it will need to come back. ${refund}`
      : "The parcel is already with the carrier, so it will need to come back. Nobody has been charged.";
  }
  return booking.payment_made ? refund : "Nobody has been charged.";
}

/** Toast after a plain cancel — from the server's ANSWER, not the request. */
export function cancelToast(res: { status?: string | null; refunded?: boolean | null; refund_amount?: number | null } | null | undefined): string {
  if (res?.status === "unpaid_return") return "Delivery cancelled — the parcel needs to come back";
  if (res?.refunded || Number(res?.refund_amount ?? 0) > 0) return "Booking cancelled — you've been refunded in full.";
  return "Booking cancelled";
}

/** Banner after the carrier cancels while holding the parcel. */
export function postPossessionResult(
  data: { penalty_amount?: number | null; refund_amount?: number | null; waiver_eligible?: boolean | null } | null | undefined,
  formatPenalty: (amount: number) => string,
): { title: string; message: string } {
  const penalty = Number(data?.penalty_amount ?? 0);
  const parts = [
    penalty > 0 ? `${formatPenalty(penalty)} penalty will be taken from your next payout.` : "No cash penalty.",
    data?.waiver_eligible ? "A waiver request is open." : null,
    Number(data?.refund_amount ?? 0) > 0
      ? "The sender has been refunded in full."
      : "The sender hadn't paid yet, so they weren't charged.",
  ];
  return { title: "Delivery cancelled", message: parts.filter(Boolean).join(" ") };
}

/** Decline dialog: a parcel never sent is a cancel, not a handoff refusal. */
export function declineCopy(dispatched: boolean): { title: string; body: string } {
  return dispatched
    ? {
        title: "Decline this parcel at handoff",
        body: "Use this when the parcel has reached you but you can't carry it — unsafe, oversized, or not what the listing described. The booking ends with no penalty to you, and your sender won't be charged.",
      }
    : {
        title: "Cancel this delivery before the parcel is sent",
        body: "Use this when you can no longer do this delivery — your trip changed, or you can't take the parcel after all. The booking ends with no penalty to you, and your sender won't be charged.",
      };
}

/** Toast after a decline: if the carrier still has it, the deal isn't over. */
export function declineToast(parcelWithCarrier: boolean): string {
  return parcelWithCarrier
    ? "Parcel declined — your sender will tell you where to send it back"
    : "Parcel declined — your sender has been notified";
}

/** Toast after the sender picks where the parcel goes back to. */
export function returnResolutionToast(resolution: string): string {
  // "I already have the parcel" closes the deal there and then (returns.ts).
  return resolution === "sender_has_parcel"
    ? "Thanks — this delivery is now closed"
    : "Saved — your carrier has been told what to do with the parcel";
}
