import assert from "node:assert/strict";
import { afterEach, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { signOutThisDevice } from "./localSignOut.ts";

// Regression: tapping "Sign out" with no connection showed "Sign out failed" and
// left the person signed in (supabase-js keeps the session when the server call
// fails). Drives the REAL supabase-js client against a fake network.

const KEY = "sb-test-auth-token";
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; });

function memoryStorage(seed: Record<string, string>) {
  const m = new Map(Object.entries(seed));
  return { m, getItem: async (k: string) => m.get(k) ?? null, setItem: async (k: string, v: string) => { m.set(k, v); }, removeItem: async (k: string) => { m.delete(k); } };
}
const stored = () => JSON.stringify({
  access_token: "access", refresh_token: "refresh", token_type: "bearer", expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  user: { id: "u1", aud: "authenticated", role: "authenticated" },
});
function client(storage: ReturnType<typeof memoryStorage>) {
  return createClient("https://test.supabase.co", "anon", {
    auth: { storage, storageKey: KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

test("offline sign-out still signs this device out and fires SIGNED_OUT", async () => {
  globalThis.fetch = (async () => { throw new TypeError("Network request failed"); }) as typeof fetch;
  const storage = memoryStorage({ [KEY]: stored() });
  const c = client(storage);
  const events: string[] = [];
  c.auth.onAuthStateChange((e) => { events.push(e); });
  // The control: plain signOut keeps the session when offline (the bug).
  const plain = await c.auth.signOut({ scope: "local" });
  assert.ok(plain.error, "expected supabase-js to report the network failure");
  assert.ok(storage.m.has(KEY), "control: supabase-js kept the session");

  const r = await signOutThisDevice(c.auth, async () => { storage.m.delete(KEY); });
  assert.equal(r.offline, true);
  assert.equal(storage.m.has(KEY), false, "the session survived sign-out");
  assert.ok(events.includes("SIGNED_OUT"), "AuthContext would never hear about it");
  assert.equal((await c.auth.getSession()).data.session, null);
});

test("a 5xx from the server is handled the same way", async () => {
  globalThis.fetch = (async () => new Response("{}", { status: 503 })) as typeof fetch;
  const storage = memoryStorage({ [KEY]: stored() });
  const r = await signOutThisDevice(client(storage).auth, async () => { storage.m.delete(KEY); });
  assert.equal(r.offline, true);
  assert.equal(storage.m.has(KEY), false);
});

test("a normal sign-out is unchanged", async () => {
  globalThis.fetch = (async () => new Response(null, { status: 204 })) as typeof fetch;
  const storage = memoryStorage({ [KEY]: stored() });
  const r = await signOutThisDevice(client(storage).auth, async () => { throw new Error("fallback must not run"); });
  assert.equal(r.offline, false);
  assert.equal(storage.m.has(KEY), false);
});
