import assert from "node:assert/strict";
import { test } from "node:test";

import { checkOnboarding } from "./onboardingCheck.ts";

/**
 * Only the server positively saying "terms not accepted" may route a user to
 * ProfileSetup. A failure to READ the profile is "unknown" (error + Try again).
 */

class TimeoutErr extends Error {
  code = "TIMEOUT";
}
const isTimeout = (e: unknown) => e instanceof TimeoutErr;
const noSleep = async () => {};

/** A loader that answers from a script, one entry per call. */
function scripted(...answers: Array<string | null | Error>) {
  let calls = 0;
  const load = async () => {
    const a = answers[Math.min(calls, answers.length - 1)];
    calls += 1;
    if (a instanceof Error) throw a;
    return a;
  };
  return { load, calls: () => calls };
}

test("existing user, profile loads: complete (goes to the app)", async () => {
  const s = scripted("2026-09-01T00:00:00Z");
  assert.deepEqual(await checkOnboarding(s.load, { isTimeout, sleep: noSleep }), { status: "complete" });
  assert.equal(s.calls(), 1);
});

test("genuine new user (server says terms empty): incomplete (ProfileSetup)", async () => {
  const s = scripted(null);
  assert.equal((await checkOnboarding(s.load, { isTimeout, sleep: noSleep })).status, "incomplete");
});

test("timeout: unknown at once, NOT retried, never 'incomplete'", async () => {
  const err = new TimeoutErr("The request timed out. Please try again.");
  const s = scripted(err, "2026-09-01T00:00:00Z");
  const r = await checkOnboarding(s.load, { isTimeout, sleep: noSleep });
  assert.equal(r.status, "unknown");
  assert.equal(r.error, err);
  assert.equal(s.calls(), 1, "our own 45s deadline is not retried");
});

test("5xx twice: unknown (error + Try again), never 'incomplete'", async () => {
  const s = scripted(new Error("Request failed with status 503"), new Error("Request failed with status 503"));
  const r = await checkOnboarding(s.load, { isTimeout, sleep: noSleep });
  assert.equal(r.status, "unknown");
  assert.equal(s.calls(), 2, "one retry for a transient failure");
});

test("5xx once then success: the retry rescues it", async () => {
  const s = scripted(new Error("Request failed with status 502"), "2026-09-01T00:00:00Z");
  assert.equal((await checkOnboarding(s.load, { isTimeout, sleep: noSleep })).status, "complete");
});

// Same classifiers AuthContext uses (ApiClientError status/code, server wording).
const isUnauthenticated = (e: unknown) => (e as { status?: number })?.status === 401;
const isDeleted = (e: unknown) => isUnauthenticated(e) && /account has been deleted/i.test((e as Error).message);
const terminal = { isTimeout, isUnauthenticated, isDeleted, sleep: noSleep };

test("401 after the client's refresh also failed: signedOut at once (terminal, not retried, not ProfileSetup)", async () => {
  const unauthorized = Object.assign(new Error("Unauthorized"), { status: 401 });
  const s = scripted(unauthorized, "2026-09-01T00:00:00Z");
  const r = await checkOnboarding(s.load, terminal);
  assert.equal(r.status, "signedOut");
  assert.equal(s.calls(), 1, "a refused session never succeeds on retry");
});

test("deleted account (UNAUTHENTICATED 'This account has been deleted.'): deleted -> AccountDeleted screen", async () => {
  const gone = Object.assign(new Error("This account has been deleted."), { status: 401 });
  const r = await checkOnboarding(scripted(gone).load, terminal);
  assert.equal(r.status, "deleted");
});

test("5xx and timeout stay 'unknown' (error with Try again + Sign out), never terminal", async () => {
  const fiveXX = Object.assign(new Error("Request failed with status 503"), { status: 503 });
  assert.equal((await checkOnboarding(scripted(fiveXX, fiveXX).load, terminal)).status, "unknown");
  const t = new TimeoutErr("The request timed out. Please try again.");
  assert.equal((await checkOnboarding(scripted(t).load, terminal)).status, "unknown");
});

test("slow success (just under the deadline) is still a success", async () => {
  const load = () => new Promise<string>((resolve) => setTimeout(() => resolve("2026-09-01T00:00:00Z"), 30));
  assert.equal((await checkOnboarding(load, { isTimeout, sleep: noSleep })).status, "complete");
});

test("waits the retry delay before the single retry", async () => {
  const waited: number[] = [];
  const s = scripted(new Error("network"), "x");
  await checkOnboarding(s.load, { isTimeout, retryDelayMs: 600, sleep: async (ms) => { waited.push(ms); } });
  assert.deepEqual(waited, [600]);
});
