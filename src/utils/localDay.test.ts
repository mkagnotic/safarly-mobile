import assert from "node:assert/strict";
import { test } from "node:test";

import { localDay, withMyTravelsDay } from "./localDay.ts";

// Client, 26 Oct 2026: own trips moved to Archive a day late.
test("localDay is the LOCAL calendar day", () => {
  assert.equal(localDay(new Date(2026, 9, 26, 23, 59)), "2026-10-26");
  assert.equal(localDay(new Date(2026, 0, 5, 0, 1)), "2026-01-05");
});
test("only the viewer's own lists carry today", () => {
  assert.equal((withMyTravelsDay({ filter: "my_archived" }) as { today?: string }).today, localDay());
  assert.deepEqual(withMyTravelsDay({ page: 2 }), { page: 2 });
  assert.deepEqual(withMyTravelsDay({ filter: "opportunities" }), { filter: "opportunities" });
  assert.equal(withMyTravelsDay(undefined), undefined);
});
