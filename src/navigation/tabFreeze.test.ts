import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 28 Oct 2026: Profile -> Verify your identity -> Android hardware back left
// Profile blank until restart. The hardware back runs goBack() at default
// (concurrent) priority, and the frozen tab's Suspense reveal broke there.
// The in-app arrow (sync priority) never showed it. Keep tabs unfrozen.
const src = readFileSync(new URL("./RootNavigator.tsx", import.meta.url), "utf8");

test("the tab navigator never freezes blurred tabs", () => {
  const start = src.indexOf("const tabScreenOptions");
  const end = src.indexOf("tabBarActiveTintColor", start);
  assert.ok(start > -1 && end > start, "tabScreenOptions block not found");
  const block = src.slice(start, end);
  assert.match(block, /freezeOnBlur:\s*false/);
  assert.doesNotMatch(block, /freezeOnBlur:\s*true/);
});

test("no tab screen turns freezing back on", () => {
  assert.doesNotMatch(src, /freezeOnBlur:\s*true/);
});

test("back still walks the visit history (Profile -> KYC -> back lands on Profile)", () => {
  assert.match(src, /<Tabs\.Navigator backBehavior="history"/);
});
