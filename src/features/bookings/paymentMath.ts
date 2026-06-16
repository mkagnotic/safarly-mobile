/** Pure payment helpers — fee math must match the server charge to the cent. */

export interface FeeBreakdown {
  fee: number;
  platformFee: number;
  total: number;
}

/** Carrier fee + 10% platform fee = total, rounded to cents like the server. */
export function feeBreakdown(feeOffered: number | null | undefined): FeeBreakdown {
  const fee = Number(feeOffered ?? 0);
  const safe = Number.isFinite(fee) && fee > 0 ? fee : 0;
  const platformFee = Math.round(safe * 0.1 * 100) / 100;
  const total = Math.round((safe + platformFee) * 100) / 100;
  return { fee: safe, platformFee, total };
}

/** Payout the carrier receives after delivery = 90% of the fee. */
export function carrierPayout(feeOffered: number | null | undefined): number {
  const { fee } = feeBreakdown(feeOffered);
  return Math.round(fee * 0.9 * 100) / 100;
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
