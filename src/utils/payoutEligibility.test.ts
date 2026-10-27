import assert from "node:assert/strict";
import { test } from "node:test";

import { countryName, payoutBlock } from "./payoutEligibility.ts";

test("payoutBlock: Stripe only serves US carriers; no country or Razorpay never blocks (web parity)", () => {
  assert.deepEqual(payoutBlock("stripe", "in"), { country: "IN" });
  assert.equal(payoutBlock("stripe", "US"), null);
  assert.equal(payoutBlock("stripe", ""), null);
  assert.equal(payoutBlock("stripe", null), null);
  assert.equal(payoutBlock("razorpay", "IN"), null);
  assert.equal(countryName("IN"), "India");
});
