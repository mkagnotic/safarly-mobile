import assert from "node:assert/strict";
import { test } from "node:test";

import { createSessionRevalidator, MIN_INTERVAL_MS, type RevalidateDeps } from "./revalidate.ts";

// Mobile now notices a session revoked elsewhere (e.g. a password reset on the
// web), the way web already did, without ever signing out on a transient error.

function deps(over: Partial<RevalidateDeps> & { at?: { t: number } } = {}) {
  const at = over.at ?? { t: 1_000_000 };
  let revoked = 0;
  const d: RevalidateDeps = {
    hasSession: () => true,
    getUser: async () => ({ error: null }),
    refreshSession: async () => ({ data: { session: {} }, error: null }),
    hasStoredSession: async () => true,
    onRevoked: () => { revoked++; },
    now: () => at.t,
    ...over,
  };
  return { d, at, revoked: () => revoked };
}

test("a valid session is left alone", async () => {
  const { d, revoked } = deps();
  assert.equal(await createSessionRevalidator(d)(), "valid");
  assert.equal(revoked(), 0);
});

test("an expired token that refreshes fine is not a logout", async () => {
  const { d, revoked } = deps({ getUser: async () => ({ error: { status: 401 } }) });
  assert.equal(await createSessionRevalidator(d)(), "valid");
  assert.equal(revoked(), 0);
});

test("a refresh that fails transiently (session still stored) keeps the user signed in", async () => {
  const { d, revoked } = deps({
    getUser: async () => ({ error: { status: 503 } }),
    refreshSession: async () => ({ data: { session: null }, error: { status: 503 } }),
    hasStoredSession: async () => true,
  });
  assert.equal(await createSessionRevalidator(d)(), "kept");
  assert.equal(revoked(), 0);
});

test("a session revoked elsewhere (definitively rejected) signs this device out", async () => {
  const { d, revoked } = deps({
    getUser: async () => ({ error: { status: 403, code: "session_not_found" } }),
    refreshSession: async () => ({ data: { session: null }, error: { status: 400, code: "refresh_token_not_found" } }),
    hasStoredSession: async () => false,
  });
  assert.equal(await createSessionRevalidator(d)(), "revoked");
  assert.equal(revoked(), 1);
});

test("an unexpected throw never signs anyone out", async () => {
  const { d, revoked } = deps({ getUser: async () => { throw new Error("boom"); } });
  assert.equal(await createSessionRevalidator(d)(), "kept");
  assert.equal(revoked(), 0);
});

test("at most one check a minute, and none without a session", async () => {
  let calls = 0;
  const at = { t: 5_000_000 };
  const { d } = deps({ at, getUser: async () => { calls++; return { error: null }; } });
  const check = createSessionRevalidator(d);
  await check();
  at.t += MIN_INTERVAL_MS - 1;
  assert.equal(await check(), "skipped");
  at.t += 2;
  await check();
  assert.equal(calls, 2);
  const none = deps({ hasSession: () => false });
  assert.equal(await createSessionRevalidator(none.d)(), "skipped");
});

test("two overlapping triggers run a single check", async () => {
  let calls = 0;
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const { d } = deps({ getUser: async () => { calls++; await gate; return { error: null }; } });
  const check = createSessionRevalidator(d);
  const first = check();
  assert.equal(await check(), "skipped");
  release();
  await first;
  assert.equal(calls, 1);
});
