import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// Screen used to fade its body from opacity 0 to 1 on every focus (native
// driver). It left whole screens invisible, with only the tab bar and gradient
// showing: Notifications on the emulator (29 Oct 2026), then My Bookings on
// staging (13 Nov 2026), AFTER the 29 Oct fix had added a reset-to-1 fallback.
// The JS value said 1; the native view stayed at 0. The fix is no fade at all.
const raw = readFileSync(new URL("./Screen.tsx", import.meta.url), "utf8");
// Comments explain the history and may name the old API; only code counts.
const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");

test("Screen has no entrance animation that could leave it invisible", () => {
  for (const banned of ["Animated", "opacity", "InteractionManager", "useIsFocused"]) {
    assert.ok(!code.includes(banned), `Screen.tsx must not use ${banned}`);
  }
});

test("the screen body is wrapped in plain Views on both keyboard paths", () => {
  assert.match(code, /<View style=\{\[styles\.flex, \{ backgroundColor: innerBg \}\]\}>\{screenBody\}<\/View>/);
  assert.match(code, /<View style=\{styles\.flex\}>\{screenBody\}<\/View>/);
});
