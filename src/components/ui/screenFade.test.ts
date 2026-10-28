import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

// 29 Oct 2026 (emulator): the bell on Inbox opened a BLANK Notifications screen.
// Screen's entrance fade sets opacity 0 then animates to 1; a fade that is
// stopped or never runs left the re-visited tab invisible. Guard the three
// ways back to opacity 1.
const src = readFileSync(new URL("./Screen.tsx", import.meta.url), "utf8");
const start = src.indexOf("if (!isFocused) return;");
const end = src.indexOf("[isFocused, transition]", start);
const effect = src.slice(start, end);

test("an interrupted fade snaps back to fully visible", () => {
  assert.match(effect, /\.start\(\(\{ finished \}\) => \{[\s\S]*?if \(!finished\) transition\.setValue\(1\)/);
});

test("leaving the screen resets the fade to visible", () => {
  const cleanup = effect.slice(effect.lastIndexOf("return () => {"));
  assert.match(cleanup, /transition\.setValue\(1\)/);
});

test("a fallback timer shows the screen if the fade never ran", () => {
  assert.match(effect, /const fallback = setTimeout\(/);
  assert.match(effect, /clearTimeout\(fallback\)/);
});
