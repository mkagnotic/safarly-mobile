import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveCopy } from "./kycPromptCopy.ts";

// 29 Oct 2026: the "under review" prompt knew nothing about the provider and
// promised "1–2 business days" for a Didit check too (web never did).
test("under review: Didit never promises 1–2 business days; manual keeps web's wording", () => {
  const didit = resolveCopy("payment", true, "didit");
  assert.equal(didit.body, "Our team is reviewing your verification. You'll be able to pay once it's approved, and we'll let you know as soon as it's done.");
  assert.doesNotMatch(didit.body, /business days/);
  const manual = resolveCopy("payment", true, "manual");
  assert.equal(manual.body, "Your identity is still being reviewed. You'll be able to pay once it's approved — usually within 1–2 business days.");
  // Default is manual (older callers).
  assert.equal(resolveCopy("payment", true).body, manual.body);
  assert.equal(resolveCopy("payment", false, "didit").title, "Verification required");
  assert.equal(resolveCopy("welcome", false, "didit").cta, "Verify now");
});
