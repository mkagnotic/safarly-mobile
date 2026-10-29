import assert from "node:assert/strict";
import { test } from "node:test";

import { offerCurrencyCode, offerCurrencyNote, ownOfferWaitKind } from "./offerResolution.ts";

test("a first offer names the parcel's currency (same words as web)", () => {
  assert.equal(offerCurrencyNote("seed", "INR"), "In INR, the parcel's currency.");
  assert.equal(offerCurrencyNote("accept", undefined), "In USD, the parcel's currency.");
});

test("counter / change: the currency is locked, and says so", () => {
  for (const mode of ["counter", "revise"] as const) {
    assert.equal(offerCurrencyNote(mode, "usd"), "In USD. Currency is locked once offers have been made.");
  }
  assert.equal(offerCurrencyCode("EUR"), "USD");
});

test("own offer: the carrier is told to set up payouts, the sender is told who it waits for", () => {
  assert.equal(ownOfferWaitKind(true, true), "setup");
  assert.equal(ownOfferWaitKind(true, false), "payouts");
  assert.equal(ownOfferWaitKind(false, true), "plain");
});
