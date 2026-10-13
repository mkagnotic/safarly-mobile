import assert from "node:assert/strict";
import { test } from "node:test";

import { REJECT_REASON_MIN, minLengthHint } from "./modalValidation.ts";

// Was "{typed}/{min} characters minimum" - "37/10 characters minimum" reads as
// 37 out of 10. Mirrors web `src/features/disputes/lib/minLength.ts`.

test("states the requirement before typing", () => {
  assert.equal(minLengthHint(0, REJECT_REASON_MIN), "Minimum 10 characters");
});

test("says how far off you are while short", () => {
  assert.equal(minLengthHint(17, 20), "Minimum 20 characters · 3 more needed");
});

test("gets out of the way once met", () => {
  assert.equal(minLengthHint(10, 10), null);
  assert.equal(minLengthHint(37, 10), null);
});
