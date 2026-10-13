import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { buildPayload, createThrottle, isReportable } from "./errorReportCore.ts";

test("real errors are reported; offline and abort noise is not", () => {
  assert.equal(isReportable("TypeError: undefined is not an object (evaluating 'trip.id')"), true);
  for (const noise of ["Network request failed", "AbortError: Aborted", "Request timed out", "", "   "]) {
    assert.equal(isReportable(noise), false, noise);
  }
});

test("one report per distinct error per 5 minutes, at most 10 per session", () => {
  let t = 0;
  const allow = createThrottle(() => t);
  assert.equal(allow("a"), true);
  assert.equal(allow("a"), false);
  t += 5 * 60 * 1000;
  assert.equal(allow("a"), true);
  for (let i = 0; i < 8; i++) assert.equal(allow(`k${i}`), true);
  assert.equal(allow("over-the-cap"), false);
});

test("the payload carries platform, version and screen, with lengths capped", () => {
  const p = buildPayload({ message: "x".repeat(5000), stack: "s".repeat(20000), screen: "OfferChat" }, "ios", "1.0.2");
  assert.equal(p.platform, "ios");
  assert.equal(p.app_version, "1.0.2");
  assert.equal(p.route, "OfferChat");
  assert.equal(p.message.length, 1000);
  assert.equal(p.stack?.length, 8000);
});

test("App.tsx installs the reporter and wraps the navigator in the boundary", () => {
  const app = readFileSync(new URL("../../App.tsx", import.meta.url), "utf8");
  assert.match(app, /installGlobalErrorReporting\(\);/);
  assert.match(app, /<AppErrorBoundary>\s*<RootNavigator \/>\s*<\/AppErrorBoundary>/);
});

test("the global handler always hands the error on to the previous handler", () => {
  const src = readFileSync(new URL("./errorReporter.ts", import.meta.url), "utf8");
  assert.match(src, /const previous = errorUtils\.getGlobalHandler\(\);[\s\S]*previous\(error, isFatal\);/);
});
