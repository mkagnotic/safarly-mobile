import assert from "node:assert/strict";
import { test } from "node:test";

import { offerComposerMode } from "./offerResolution.ts";

test("no live offer seeds a first offer", () => {
  assert.equal(offerComposerMode(null), "seed");
  assert.equal(offerComposerMode(undefined), "seed");
});

test("their open offer is countered", () => {
  assert.equal(offerComposerMode({ mine: false, carrierRequestId: "cr-1" }), "counter");
});

test("my own open offer is revised, never countered", () => {
  // Countering yourself made no sense, and offering nothing left "Waiting…" stuck.
  assert.equal(offerComposerMode({ mine: true, carrierRequestId: "cr-1" }), "revise");
  assert.equal(offerComposerMode({ mine: true, carrierRequestId: undefined }), "revise");
});

test("a live card without a deal id still seeds", () => {
  assert.equal(offerComposerMode({ mine: false, carrierRequestId: undefined }), "seed");
});
