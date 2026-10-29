/**
 * The smallest amount anyone can list or offer (client, 26 Oct 2026): $5 or ₹500.
 * The server enforces the same table (supabase/functions/_shared/money.ts);
 * this gives the same message instantly, before sending. Web: src/lib/minAmount.ts.
 */
export const MIN_AMOUNT: Record<string, number> = { USD: 5, INR: 500 };

export function minAmountFor(currency?: string | null): number {
  return MIN_AMOUNT[(currency || "USD").toUpperCase()] ?? MIN_AMOUNT.USD;
}

/** A user-facing reason the amount is too small for its currency, or undefined. */
export function minAmountProblem(amount: unknown, currency?: string | null): string | undefined {
  const ccy = (currency || "USD").toUpperCase() === "INR" ? "INR" : "USD";
  const min = minAmountFor(ccy);
  const n = Number(amount);
  if (!Number.isFinite(n) || n < min) {
    // Self-contained (no money.ts import) so the node test runner can load it.
    const label = `${ccy === "INR" ? "₹" : "$"}${min.toFixed(2)}`;
    return `The minimum amount is ${label}. Please enter ${label} or more.`;
  }
  return undefined;
}
