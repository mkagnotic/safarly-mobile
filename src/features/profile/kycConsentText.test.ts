import assert from "node:assert/strict";
import { test } from "node:test";

import { KYC_CONSENT_AGREEMENT, kycConsentParagraphs } from "./kycConsentText.ts";

// The consent wording (same as web): what is collected, why, how long, who
// sees it, where to ask, and no blank placeholder ever reaches the screen.

test("states what, why, how long, who and where to ask, from the server's facts", () => {
  const text = kycConsentParagraphs({ retentionDays: 45, contactEmail: "dpo@example.com" }).join(" ");
  assert.match(text, /government ID/);
  assert.match(text, /selfie/);
  assert.match(text, /compares your selfie/);
  assert.match(text, /up to 45 days/);
  assert.match(text, /dpo@example\.com/);
  assert.match(text, /don't use automated face recognition/);
  assert.match(KYC_CONSENT_AGREEMENT, /I agree/);
});

test("the wording never contains a blank placeholder", () => {
  for (const p of kycConsentParagraphs({ retentionDays: 30, contactEmail: "a@b.co" })) {
    assert.doesNotMatch(p, /\[|\]|undefined|null/);
  }
});
