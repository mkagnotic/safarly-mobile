import assert from "node:assert/strict";
import { test } from "node:test";

import { hasEarnings, moneyAmounts, transactionCount, type PaymentsSummary } from "./paymentsSummary.ts";

// The Payments header renders one amount per currency - it used to add USD and
// INR into one number. Mirrors web `src/features/payments/lib/__tests__/paymentsSummary.test.ts`.

const base: PaymentsSummary = { total_spent: 50, total_refunded: 0, total_earned: 0, count: 3 };

test("one amount per currency that has money, never a sum", () => {
  const s: PaymentsSummary = {
    ...base,
    currency: "USD",
    by_currency: [
      { currency: "USD", spent: 50, refunded: 0, earned: 0, paid_out: 0 },
      { currency: "INR", spent: 3600, refunded: 0, earned: 0, paid_out: 0 },
    ],
  };
  assert.deepEqual(moneyAmounts(s, "spent"), [
    { amount: 50, currency: "USD" },
    { amount: 3600, currency: "INR" },
  ]);
});

test("a single zero in the summary's currency when nothing qualifies", () => {
  const s: PaymentsSummary = {
    ...base,
    currency: "INR",
    by_currency: [{ currency: "INR", spent: 10, refunded: 0, earned: 0, paid_out: 0 }],
  };
  assert.deepEqual(moneyAmounts(s, "refunded"), [{ amount: 0, currency: "INR" }]);
});

test("an older backend: the flat figure in the fallback currency", () => {
  assert.deepEqual(moneyAmounts(base, "spent", "INR"), [{ amount: 50, currency: "INR" }]);
  assert.deepEqual(moneyAmounts(undefined, "spent"), [{ amount: 0, currency: null }]);
});

test("earnings in any currency count; real-transaction count wins over the page total", () => {
  assert.equal(
    hasEarnings({
      ...base,
      by_currency: [{ currency: "INR", spent: 0, refunded: 0, earned: 5, paid_out: 0 }],
    }),
    true,
  );
  assert.equal(hasEarnings(base), false);
  assert.equal(transactionCount({ ...base, transactions_count: 10 }, 429), 10);
  assert.equal(transactionCount(base, 429), 3);
  assert.equal(transactionCount(null, 429), 429);
});
