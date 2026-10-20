import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, mock, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { bodyBytes, isTokenRefreshRequest, resilientAuthFetch, uploadTimeoutMs } from "./authFetch.ts";

// Mirrors web's `src/test/authRefreshResilience.test.ts`.
//
// Regression: users were logged out "after some time". Production auth answered
// token refreshes with 500s while its database timed out, and supabase-js treats
// a 500 on refresh as fatal: it deletes the stored session. These drive the REAL
// supabase-js client against a fake network, so the control case shows the bug
// and the others show the wrapper closing it.

const URL_BASE = "https://test.supabase.co";
const STORAGE_KEY = "sb-test-auth-token";

const realFetch = globalThis.fetch;
let network: (url: string) => Response;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

function session(accessToken: string, refreshToken: string, expiresInSec: number) {
  return {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: "bearer",
    expires_in: 3600,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
    user: { id: "u1", aud: "authenticated", role: "authenticated", app_metadata: {}, user_metadata: {}, created_at: "2026-01-01T00:00:00Z" },
  };
}

function makeClient(fetchImpl: typeof fetch) {
  const map = new Map<string, string>();
  map.set(STORAGE_KEY, JSON.stringify(session("expired", "refresh-1", -60)));
  const storage = {
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
  };
  const client = createClient(URL_BASE, "anon", {
    auth: { storage, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
    global: { fetch: fetchImpl },
  });
  return { client, map };
}

/** 500 for the first `failures` refreshes, then a fresh session. */
function flakyAuth(failures: number) {
  let calls = 0;
  return () => {
    calls += 1;
    return calls <= failures
      ? json(500, { code: 500, error_code: "unexpected_failure", msg: "error finding refresh token" })
      : json(200, session("fresh", "refresh-2", 3600));
  };
}

describe("token refresh during an auth outage", () => {
  beforeEach(() => {
    globalThis.fetch = (async (input: RequestInfo | URL) =>
      network(typeof input === "string" ? input : input instanceof URL ? input.href : input.url)) as typeof fetch;
  });
  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test("control: without the wrapper, one 500 deletes the stored session (the bug)", async () => {
    network = flakyAuth(1);
    const { client, map } = makeClient((i, init) => globalThis.fetch(i, init));
    const { data } = await client.auth.getSession();
    assert.equal(data.session, null);
    assert.equal(map.has(STORAGE_KEY), false);
  });

  test("with the wrapper, 500s are retried and the session survives", async () => {
    network = flakyAuth(2);
    const { client, map } = makeClient(resilientAuthFetch);
    const { data } = await client.auth.getSession();
    assert.equal(data.session?.access_token, "fresh");
    assert.equal(JSON.parse(map.get(STORAGE_KEY)!).refresh_token, "refresh-2");
  });

  test("a rate-limited refresh (429) is retried and the session survives", async () => {
    let calls = 0;
    network = () => {
      calls += 1;
      return calls === 1
        ? json(429, { code: 429, error_code: "over_request_rate_limit", msg: "Request rate limit reached" })
        : json(200, session("fresh", "refresh-2", 3600));
    };
    const { client, map } = makeClient(resilientAuthFetch);
    const { data } = await client.auth.getSession();
    assert.equal(data.session?.access_token, "fresh");
    assert.equal(map.has(STORAGE_KEY), true);
  });

  test("a genuinely dead refresh token (400) still signs the user out", async () => {
    network = () => json(400, { code: 400, error_code: "refresh_token_not_found", msg: "Refresh Token Not Found" });
    const { client, map } = makeClient(resilientAuthFetch);
    await client.auth.getSession();
    assert.equal(map.has(STORAGE_KEY), false);
  });

  test("a 500 from anything other than a refresh is passed through untouched", async () => {
    network = () => json(500, { msg: "boom" });
    assert.equal((await resilientAuthFetch(`${URL_BASE}/auth/v1/token?grant_type=password`)).status, 500);
    assert.equal((await resilientAuthFetch(`${URL_BASE}/functions/v1/bookings`)).status, 500);
  });
});

describe("default deadline on supabase-js's own requests", () => {
  /** A network that never answers, but honours abort like a real fetch. */
  const hung = ((_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_, reject) => {
      const fail = () => {
        const e = new Error("Aborted");
        e.name = "AbortError";
        reject(e);
      };
      if (init?.signal?.aborted) fail();
      else init?.signal?.addEventListener("abort", fail);
    })) as typeof fetch;
  const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

  beforeEach(() => {
    mock.timers.enable({ apis: ["setTimeout"] });
    globalThis.fetch = hung;
  });
  afterEach(() => {
    mock.timers.reset();
    globalThis.fetch = realFetch;
  });

  test("a token refresh that never answers is abandoned, and the session is KEPT (nobody signed out)", async () => {
    const { client, map } = makeClient(resilientAuthFetch);
    let done = false;
    void client.auth.getSession().then(() => { done = true; }, () => { done = true; });
    // supabase-js retries a failed refresh with backoff; drive the clock until it gives up.
    for (let i = 0; i < 600 && !done; i++) {
      mock.timers.tick(1000);
      await flush();
    }
    assert.ok(done, "getSession() settles instead of hanging forever");
    assert.equal(map.has(STORAGE_KEY), true, "a timeout is not a rejection of the refresh token");
  });

  test("ordinary requests give up at 45s with timeout wording; storage gets 90s", async () => {
    let rest: unknown = "pending";
    let storage: unknown = "pending";
    void resilientAuthFetch(`${URL_BASE}/rest/v1/user_profiles`).then(() => { rest = "resolved"; }, (e) => { rest = e; });
    void resilientAuthFetch(`${URL_BASE}/storage/v1/object/avatars/x.jpg`, { method: "POST" }).then(() => { storage = "resolved"; }, (e) => { storage = e; });

    mock.timers.tick(44_999);
    await flush();
    assert.equal(rest, "pending");
    mock.timers.tick(1);
    await flush();
    assert.match((rest as Error).message, /timed out/, "maps to the existing 'That took too long' copy");
    assert.equal(storage, "pending", "uploads are allowed longer");

    mock.timers.tick(45_000);
    await flush();
    assert.match((storage as Error).message, /timed out/);
  });

  test("a caller that passes its own signal keeps control: no default deadline is added", async () => {
    const caller = new AbortController();
    let outcome: unknown = "pending";
    void resilientAuthFetch(`${URL_BASE}/rest/v1/x`, { signal: caller.signal }).then(() => { outcome = "resolved"; }, (e) => { outcome = e; });
    mock.timers.tick(120_000);
    await flush();
    assert.equal(outcome, "pending");
    caller.abort();
    await flush();
    assert.equal((outcome as Error).name, "AbortError", "the caller's cancel, not our timeout");
  });
});

describe("upload deadline scales with size (weak Indian uplink: 64 KB/s)", () => {
  test("small uploads keep the 90s floor; big ones get time to finish; capped at 10 min", () => {
    assert.equal(uploadTimeoutMs(0), 90_000);
    assert.equal(uploadTimeoutMs(500 * 1024), 90_000);                 // avatar: floor
    assert.equal(uploadTimeoutMs(3 * 1024 * 1024), 60_000 + 48_000);   // phone photo ~3 MB -> 108s
    assert.equal(uploadTimeoutMs(10 * 1024 * 1024), 60_000 + 160_000); // 10 MB limit -> 220s
    assert.equal(uploadTimeoutMs(50 * 1024 * 1024), 600_000);          // cap
    assert.equal(uploadTimeoutMs(undefined), 600_000);                 // unknown size: generous cap
  });
  test("measures the bodies uploads actually send", () => {
    assert.equal(bodyBytes(new Uint8Array(1234)), 1234);
    assert.equal(bodyBytes(new ArrayBuffer(10)), 10);
    assert.equal(bodyBytes(new Blob(["abcd"])), 4);
    assert.equal(bodyBytes(undefined), 0);
  });
  test("a 10 MB storage upload is NOT cut off at 90s", async () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    globalThis.fetch = ((_i: RequestInfo | URL, init?: RequestInit) => new Promise<Response>((_, reject) => {
      init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("Aborted"), { name: "AbortError" })));
    })) as typeof fetch;
    let outcome: unknown = "pending";
    void resilientAuthFetch(`${URL_BASE}/storage/v1/object/kyc-documents/a.pdf`, { method: "POST", body: new Uint8Array(10 * 1024 * 1024) })
      .then(() => { outcome = "resolved"; }, (e) => { outcome = e; });
    mock.timers.tick(200_000);
    await new Promise<void>((r) => setImmediate(r));
    assert.equal(outcome, "pending", "still uploading at 200s");
    mock.timers.tick(20_000);
    await new Promise<void>((r) => setImmediate(r));
    assert.match((outcome as Error).message, /timed out/);
    mock.timers.reset();
    globalThis.fetch = realFetch;
  });
});

describe("isTokenRefreshRequest", () => {
  test("matches only the refresh grant on the auth token endpoint", () => {
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`), true);
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/auth/v1/token?grant_type=password`), false);
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/rest/v1/x?grant_type=refresh_token`), false);
  });
});
