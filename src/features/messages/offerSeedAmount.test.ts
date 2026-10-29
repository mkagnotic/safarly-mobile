import assert from "node:assert/strict";
import { test } from "node:test";

import { offerSeedAmount } from "./offerSeedAmount.ts";

// E4: agreed 25, listing 30, cancelled with no re-price. The server answers 25 from
// the agreement; the composer must open at 25, not at the listing's 30.
const e4 = { asking_amount: 30, last_agreed_amount: 25, suggested_amount: 25, suggested_source: "agreed" };

test("a first offer opens at the server's suggestion, never the asking price", () => {
  assert.equal(offerSeedAmount("seed", null, e4), 25);
  assert.equal(offerSeedAmount(undefined, null, e4), 25);
});

test("a re-price after the agreement is the server's call too", () => {
  assert.equal(offerSeedAmount("seed", null, { ...e4, asking_amount: 40, suggested_amount: 40 }), 40);
});

test("a counter or a revision opens at the offer being answered", () => {
  assert.equal(offerSeedAmount("counter", 28, e4), 28);
  assert.equal(offerSeedAmount("revise", 27, e4), 27);
  assert.equal(offerSeedAmount("counter", null, e4), null);
});

test("no pricing yet → an empty box, not a guess", () => {
  assert.equal(offerSeedAmount("seed", null, null), null);
  assert.equal(offerSeedAmount("seed", null, { suggested_amount: null }), null);
});
