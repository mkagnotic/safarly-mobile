import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { deepLinkBelongsOnTab } from "./deepLinkTab.ts";

const read = (rel: string) => readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Client, 4 Nov 2026: a booking declined at handover, opened from a notification,
// stayed pinned under "Active" on the phone. Same rule as web.
test("a linked booking is pinned only on its own tab", () => {
  const b = { tab: "cancelled" };
  assert.equal(deepLinkBelongsOnTab(b, 0), true);
  assert.equal(deepLinkBelongsOnTab(b, 3), true);
  assert.equal(deepLinkBelongsOnTab(b, 1), false);
  assert.equal(deepLinkBelongsOnTab(b, 2), false);
  assert.equal(deepLinkBelongsOnTab({ tab: "active" }, 1), true);
  assert.equal(deepLinkBelongsOnTab({ tab: "delivered" }, 2), true);
  assert.equal(deepLinkBelongsOnTab({}, 1), true);
});

test("the bookings screen gates the fetched target on it and never forces the tab", () => {
  const s = read("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes("deepLinkBelongsOnTab(fetchedTarget, filterIdx)"));
});
