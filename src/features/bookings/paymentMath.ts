/** Pure payment helpers — fee math must match the server charge to the cent. */

export interface FeeBreakdown {
  fee: number;
  platformFee: number;
  total: number;
}

/**
 * The base amount for a booking: the AGREED price.
 *
 * ⚠️ Never `parcel.fee_offered` on its own. That is only the sender's ASKING price
 * and stays editable after the deal is agreed, so a screen quoting it promises one
 * number while checkout (and the server) take another - the reported "Pay $71.50" in
 * chat against "$110.00" at the till. `fee_offered` survives purely as a fallback for
 * bookings made before `agreed_amount` existed.
 */
export function bookingFee(
  booking: { agreed_amount?: number | string | null; parcel?: { fee_offered?: number | string | null } | null } | null | undefined,
): number {
  const agreed = booking?.agreed_amount;
  const raw = agreed != null ? agreed : booking?.parcel?.fee_offered;
  const n = Number(raw ?? 0);
  return Number.isFinite(n) ? n : 0;
}

/** Carrier fee + 10% platform fee = total, rounded to cents like the server. */
export function feeBreakdown(feeOffered: number | null | undefined): FeeBreakdown {
  const fee = Number(feeOffered ?? 0);
  const safe = Number.isFinite(fee) && fee > 0 ? fee : 0;
  const platformFee = Math.round(safe * 0.1 * 100) / 100;
  const total = Math.round((safe + platformFee) * 100) / 100;
  return { fee: safe, platformFee, total };
}

/**
 * Payout the carrier receives after delivery = the full agreed fee. The 10%
 * platform fee is charged to the SENDER on top (see `feeBreakdown`), so nothing
 * is deducted from the carrier — this matches what the server pays out.
 */
export function carrierPayout(feeOffered: number | null | undefined): number {
  return feeBreakdown(feeOffered).fee;
}

/** "2d 4h left to pay" / "5h 12m left to pay" / "12m left to pay". */
export function formatCountdown(msLeft: number): string {
  const mins = Math.max(0, Math.floor(msLeft / 60000));
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const m = mins % 60;
  if (d > 0) return `${d}d ${h}h left to pay`;
  if (h > 0) return `${h}h ${m}m left to pay`;
  return `${m}m left to pay`;
}

/** Urgent when under 6 hours remain (and not already expired). */
export function isUrgent(msLeft: number): boolean {
  return msLeft > 0 && msLeft < 6 * 3600_000;
}

/**
 * When the sender must have paid by: the 48 h window, then - once the carrier
 * holds the parcel - the 24 h grace after it. The server takes the payment until
 * the grace sweep moves the booking to unpaid_return; this screen said "Payment
 * window expired" and blocked paying while the grace notice said "You have 24
 * hours left" (27 Oct 2026). Web twin: src/lib/payDeadline.ts.
 */
export const PAYMENT_GRACE_MS = 24 * 3_600_000;

export function payDeadline(b: {
  payment_expires_at?: string | null;
  payment_grace_started_at?: string | null;
  handoff_accepted_at?: string | null;
}, now = Date.now()): { at: number; grace: boolean } | null {
  if (!b.payment_expires_at) return null;
  const windowEnd = new Date(b.payment_expires_at).getTime();
  if (windowEnd > now || !b.handoff_accepted_at) return { at: windowEnd, grace: false };
  const graceStart = b.payment_grace_started_at ? new Date(b.payment_grace_started_at).getTime() : windowEnd;
  return { at: graceStart + PAYMENT_GRACE_MS, grace: true };
}
