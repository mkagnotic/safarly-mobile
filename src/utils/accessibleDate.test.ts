import assert from "node:assert/strict";
import { test } from "node:test";

import { accessibleDateLabel } from "./accessibleDate.ts";

test("a day cell reads weekday, month, day and year", () => {
  assert.equal(accessibleDateLabel(new Date(2026, 10, 3)), "Tuesday, November 3, 2026");
  assert.equal(accessibleDateLabel(new Date(2027, 0, 1)), "Friday, January 1, 2027");
});
