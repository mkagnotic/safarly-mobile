import assert from "node:assert/strict";
import { test } from "node:test";

import { MIN_AMOUNT, minAmountProblem } from "./minAmount.ts";

// Client, 26 Oct 2026: $5 / ₹500 minimum everywhere an amount is entered.
test("the minimum is $5 and ₹500 (same table as the server)", () => {
  assert.deepEqual(MIN_AMOUNT, { USD: 5, INR: 500 });
  assert.equal(minAmountProblem(5, "USD"), undefined);
  assert.equal(minAmountProblem(500, "INR"), undefined);
});
test("below it is refused, naming the minimum in the right currency", () => {
  assert.match(minAmountProblem(4.99, "USD") ?? "", /\$5\.00/);
  assert.match(minAmountProblem(499, "INR") ?? "", /₹500\.00/);
});
