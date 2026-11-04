import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { matchTarget, pickMatchableDeal } from "./matchableDeal.ts";

/**
 * The chosen-deal rule (staging, 4 Nov 2026 - User Five / User Six). A deal that
 * ended must never be named by Match; only a deal still at the match step is.
 * Mirrors web src/features/messages/lib/matchableDeal.test.ts.
 */
const OLD = { request_status: "withdrawn", parcel_id: "c168b007", trip_id: "1dd98ecf" };
const LIVE = { request_status: "pending", parcel_id: "ad5badcb", trip_id: "ae92aa45" };

test("an ended deal (retired request) is never named, whatever state it shows", () => {
  for (const s of ["NEGOTIATING", "MATCH_REQUESTED", "CANCELLED", "COMPLETED"]) {
    assert.equal(pickMatchableDeal(OLD, s), null, s);
  }
  assert.equal(pickMatchableDeal({ ...OLD, request_status: "rejected" }, "NEGOTIATING"), null);
  assert.deepEqual(matchTarget(pickMatchableDeal(OLD, "CANCELLED")), { parcel_id: undefined, trip_id: undefined },
    "Match names nothing -> the server probes and asks when there are several");
});

test("a live deal at the match step is named; past it, nothing is", () => {
  for (const s of ["NEGOTIATING", "MATCH_REQUESTED", "MATCH_DECLINED"]) assert.equal(pickMatchableDeal(LIVE, s), LIVE, s);
  for (const s of ["TRAVEL_VERIFICATION", "PRICING", "HANDOFF", "CANCELLED", "COMPLETED", ""]) {
    assert.equal(pickMatchableDeal(LIVE, s), null, s);
  }
  assert.deepEqual(matchTarget(LIVE), { parcel_id: "ad5badcb", trip_id: "ae92aa45" });
  assert.equal(pickMatchableDeal(null, "NEGOTIATING"), null);
});

test("the chat hook uses this rule (no local copy that can drift)", () => {
  const hook = readFileSync("src/features/messages/chat/hooks/useChatMatchStatus.ts", "utf8");
  assert.ok(hook.includes("pickMatchableDeal(activeDeal, workflow?.state)"));
  assert.ok(!hook.includes('const MATCH_STEP_STATES = ["NEGOTIATING"'), "no inline copy of the step list");
  const actions = readFileSync("src/features/messages/chat/hooks/useChatMatchActions.ts", "utf8");
  assert.ok(actions.includes("...matchTarget(matchableDeal)"));
});
