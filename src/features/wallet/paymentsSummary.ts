/**
 * The Payments header, per currency.
 *
 * The server (payment-handler `summary.ts`) used to send one number per tile,
 * adding rupees and dollars together. It now sends `by_currency`; a tile shows
 * one line per currency it has money in, and never sums across them. Kept
 * logic-identical with web `src/features/payments/lib/paymentsSummary.ts`.
 */
import type { TransactionsSummary } from "@/services/api";

export interface CurrencyTotals {
  currency: string;
  spent: number;
  refunded: number;
  earned: number;
  paid_out: number;
}

/** What the server sends now. Every new field is optional: an older backend omits them. */
export type PaymentsSummary = TransactionsSummary & {
  currency?: string | null;
  transactions_count?: number;
  by_currency?: CurrencyTotals[];
};

type MoneyField = "spent" | "refunded" | "earned";

const LEGACY: Record<MoneyField, keyof TransactionsSummary> = {
  spent: "total_spent",
  refunded: "total_refunded",
  earned: "total_earned",
};

export interface MoneyAmount {
  amount: number;
  currency: string | null;
}

/**
 * One amount per currency that has any; a single zero when none do. Returned
 * unformatted (the caller runs `formatMoney`) so this stays dependency-free and
 * unit-testable on both platforms.
 */
export function moneyAmounts(
  summary: PaymentsSummary | null | undefined,
  field: MoneyField,
  fallbackCurrency?: string | null,
): MoneyAmount[] {
  const rows = summary?.by_currency;
  if (rows && rows.length) {
    const nonZero = rows
      .filter((r) => Number(r[field]) > 0)
      .map((r) => ({ amount: Number(r[field]), currency: r.currency }));
    return nonZero.length ? nonZero : [{ amount: 0, currency: summary?.currency ?? rows[0].currency }];
  }
  // An older backend: one figure, in whatever currency it names (or the caller's guess).
  return [{ amount: Number(summary?.[LEGACY[field]] ?? 0), currency: summary?.currency ?? fallbackCurrency ?? null }];
}

/** Whether the user has earned anything, in any currency. */
export function hasEarnings(summary: PaymentsSummary | null | undefined): boolean {
  const rows = summary?.by_currency;
  if (rows && rows.length) return rows.some((r) => Number(r.earned) > 0);
  return Number(summary?.total_earned ?? 0) > 0;
}

/** Real transactions only - abandoned checkouts are not transactions. */
export function transactionCount(summary: PaymentsSummary | null | undefined, fallback: number): number {
  return summary?.transactions_count ?? summary?.count ?? fallback;
}
