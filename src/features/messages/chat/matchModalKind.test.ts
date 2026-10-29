import { test } from "node:test";
import assert from "node:assert/strict";

import { matchModalKind } from "./matchModalKind.ts";

/** Twin of web's lib/matchModalKind.test.ts. */
test("parcel deal in a thread labelled buddy reads as a parcel match", () => {
  assert.equal(matchModalKind({ contextType: "buddy", hasParcelDeal: true }), "booking");
});
test("pure buddy thread (no parcel deal) reads as buddy", () => {
  assert.equal(matchModalKind({ contextType: "buddy", hasParcelDeal: false }), "buddy");
});
test("booking thread reads as booking with or without a deal", () => {
  assert.equal(matchModalKind({ contextType: "booking", hasParcelDeal: true }), "booking");
  assert.equal(matchModalKind({ contextType: "booking", hasParcelDeal: false }), "booking");
});
test("missing context type defaults to booking", () => {
  assert.equal(matchModalKind({ contextType: undefined, hasParcelDeal: false }), "booking");
  assert.equal(matchModalKind({ contextType: null, hasParcelDeal: false }), "booking");
});
test("an explicit kind wins (the buddy pin)", () => {
  assert.equal(matchModalKind({ contextType: "booking", hasParcelDeal: true, explicitKind: "buddy" }), "buddy");
  assert.equal(matchModalKind({ contextType: "buddy", hasParcelDeal: false, explicitKind: "booking" }), "booking");
});
