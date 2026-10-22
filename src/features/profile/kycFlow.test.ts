import assert from "node:assert/strict";
import { test } from "node:test";

import {
  DIDIT_COPY,
  KYC_RETURN_URL,
  attemptsLeftText,
  diditView,
  initiateErrorAction,
  isDiditUrl,
  kycMode,
  kycPollInterval,
  statusCheckMessage,
  startLabel,
} from "./kycFlow.ts";
import { DIDIT_CONSENT_AGREEMENT, diditConsentParagraphs } from "./kycConsentText.ts";

// Identity verification with Didit on mobile: the same states, rules and copy
// as web. The server decides; the app only starts/continues and reads status.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const block = (over: Record<string, unknown> = {}): any => ({
  provider: "didit", available: true, state: "not_started", attempts_used: 0, max_attempts: 3, attempts_left: 3,
  can_start: true, reason: null, manual_upload: false, consent_required: false, session_started_at: null, ...over,
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const consent = (over: Record<string, unknown> = {}): any => ({
  required: false, enabled: true, variant: "didit", policy_version: "d1", retention_days: 180, contact_email: "admin@mysafarly.com", ...over,
});

test("mode: manual switch (or an older server) = today's wizard; Didit down + uploads allowed = fallback", () => {
  assert.equal(kycMode(null, false), "manual");
  assert.equal(kycMode(block({ provider: "manual" }), false), "manual");
  assert.equal(kycMode(block(), false), "didit");
  assert.equal(kycMode(block({ available: false, manual_upload: true }), false), "manual-fallback");
  assert.equal(kycMode(block({ manual_upload: true }), true), "manual-fallback");
  // Uploads off: Didit's own "temporarily unavailable" notice instead.
  assert.equal(kycMode(block({ available: false, manual_upload: false }), false), "didit");
});

test("every server state maps to exactly one view", () => {
  assert.equal(diditView(block({ state: "approved" }), consent()).kind, "approved");
  assert.equal(diditView(block({ state: "in_review" }), consent()).kind, "in_review");
  assert.equal(diditView(block({ state: "in_progress" }), consent()).kind, "in_progress");
  assert.equal(diditView(block(), consent()).kind, "not_started");
  assert.deepEqual(
    diditView(block({ state: "declined", reason: "Your ID has expired.", attempts_left: 2 }), consent()),
    { kind: "declined", reason: "Your ID has expired.", attemptsLeft: 2 },
  );
  assert.deepEqual(diditView(block({ state: "declined" }), consent()), { kind: "declined", reason: DIDIT_COPY.declinedFallback, attemptsLeft: 3 });
  assert.deepEqual(
    diditView(block({ state: "attempts_exhausted", reason: DIDIT_COPY.exhausted }), consent()),
    { kind: "exhausted", reason: DIDIT_COPY.exhausted, contactEmail: "admin@mysafarly.com" },
  );
});

test("consent always comes first, and doesn't flash back after I agree", () => {
  assert.equal(diditView(block({ consent_required: true }), consent({ required: true })).kind, "consent");
  assert.equal(diditView(block({ consent_required: true }), consent({ required: true }), { consentAgreed: true }).kind, "not_started");
  // Wording not configured on the server: never a consent screen with blanks.
  assert.equal(diditView(block({ consent_required: true }), consent({ required: true, retention_days: null })).kind, "unavailable");
});

test("Didit unavailable = retry-later; a decided state still shows", () => {
  assert.equal(diditView(block({ available: false }), consent()).kind, "unavailable");
  assert.equal(diditView(block(), consent(), { unavailable: true }).kind, "unavailable");
  assert.equal(diditView(block({ available: false, state: "approved" }), consent()).kind, "approved");
});

test("only Didit's hosted page is ever opened; it returns to safarly://kyc-return", () => {
  assert.equal(isDiditUrl("https://verify.didit.me/session/abc"), true);
  assert.equal(isDiditUrl("https://evil.example/verify.didit.me/"), false);
  assert.equal(isDiditUrl("http://verify.didit.me/session/abc"), false);
  assert.equal(isDiditUrl(undefined), false);
  assert.equal(KYC_RETURN_URL, "safarly://kyc-return");
});

test("polling: 5 s for 2 min, then 15 s, stops at 30 min; never when not in progress", () => {
  const t0 = Date.parse("2026-10-19T10:00:00Z");
  const p = block({ state: "in_progress", session_started_at: new Date(t0).toISOString() });
  assert.equal(kycPollInterval(p, t0 + 60_000), 5_000);
  assert.equal(kycPollInterval(p, t0 + 3 * 60_000), 15_000);
  assert.equal(kycPollInterval(p, t0 + 30 * 60_000), false);
  assert.equal(kycPollInterval(block({ state: "declined" }), t0), false);
  assert.equal(kycPollInterval(block({ provider: "manual", state: "in_progress" }), t0), false);
  assert.equal(kycPollInterval(null), false);
});

test("start errors: outage → unavailable; server moved on → refresh; anything else → message", () => {
  assert.equal(initiateErrorAction({ code: "KYC_PROVIDER_UNAVAILABLE", status: 503 }), "unavailable");
  assert.equal(initiateErrorAction({ code: "INTERNAL_ERROR", status: 500 }), "unavailable");
  assert.equal(initiateErrorAction({ code: "KYC_PROVIDER_DISABLED", status: 409 }), "unavailable");
  for (const code of ["KYC_CONSENT_REQUIRED", "KYC_ATTEMPTS_EXHAUSTED", "CONFLICT"]) {
    assert.equal(initiateErrorAction({ code, status: 409 }), "refresh");
  }
  assert.equal(initiateErrorAction({ code: "RATE_LIMITED", status: 429 }), "message");
  assert.equal(initiateErrorAction(null), "message");
});

test("labels and copy match web", () => {
  assert.equal(startLabel("not_started"), "Start verification");
  assert.equal(startLabel("in_progress"), "Continue verification");
  assert.equal(startLabel("declined"), "Try again");
  assert.equal(attemptsLeftText(1), "You have 1 attempt left.");
  assert.equal(attemptsLeftText(2), "You have 2 attempts left.");
  assert.equal(DIDIT_COPY.exhausted, "Our team will review your verification and contact you.");
});

test("the Didit consent wording never shows a blank and names who, what, where, how long", () => {
  const text = diditConsentParagraphs({ retentionDays: 180, contactEmail: "admin@mysafarly.com" })
    .map((p) => `${p.lead ?? ""} ${p.text}`).join(" ");
  assert.doesNotMatch(text, /\[|\]|undefined|null/);
  for (const must of ["Didit", "European Union", "face template", "biometric", "180 days", "admin@mysafarly.com"]) {
    assert.match(text, new RegExp(must));
  }
  assert.match(DIDIT_CONSENT_AGREEMENT, /written consent/);
});

test("Check status always answers: not finished / can't reach / just checked", () => {
  // Client, 22 Oct 2026: the button looked dead in the first minutes of a session.
  const asked = statusCheckMessage({ state: "in_progress", check: { result: "asked" } });
  assert.equal(asked?.tone, "info");
  assert.match(asked!.text, /haven't finished verification yet/);
  assert.match(asked!.text, /Continue verification/);
  assert.equal(statusCheckMessage({ state: "in_progress", check: { result: "unreachable" } })?.tone, "warning");
  assert.match(statusCheckMessage({ state: "in_progress", check: { result: "too_soon" } })!.text, /just checked/);
  // An older server sends no `check`: still a sentence, never silence.
  assert.match(statusCheckMessage({ state: "in_progress" })!.text, /No result yet/);
});

test("Check status says nothing when the screen itself moved on", () => {
  for (const state of ["approved", "in_review", "declined", "not_started"]) {
    assert.equal(statusCheckMessage({ state, check: { result: "asked" } }), null, state);
  }
  assert.equal(statusCheckMessage(null), null);
});
