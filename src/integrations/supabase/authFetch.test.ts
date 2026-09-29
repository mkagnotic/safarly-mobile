import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { isTokenRefreshRequest, resilientAuthFetch } from "./authFetch.ts";

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

describe("isTokenRefreshRequest", () => {
  test("matches only the refresh grant on the auth token endpoint", () => {
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/auth/v1/token?grant_type=refresh_token`), true);
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/auth/v1/token?grant_type=password`), false);
    assert.equal(isTokenRefreshRequest(`${URL_BASE}/rest/v1/x?grant_type=refresh_token`), false);
  });
});
