import assert from "node:assert/strict";
import { afterEach, describe, test } from "node:test";

import { createClient } from "@supabase/supabase-js";

import { resilientAuthFetch } from "./authFetch.ts";
import {
  CHUNK_CHARS, createSecureSessionStorage, readChunked, splitIntoChunks, writeChunked,
  type KeyValueStore, type LegacyStore,
} from "./secureStorageCore.ts";

// The Supabase session moves from AsyncStorage to the device keystore. The
// promise that matters: NOBODY is signed out by the update, and none of the
// spurious-logout protections change. Several cases drive the REAL supabase-js
// client against these stores and a fake network.

const KEY = "sb-test-auth-token";
const URL_BASE = "https://test.supabase.co";

function memoryKeystore() {
  const m = new Map<string, string>();
  let failWrites = false;
  let failAll = false;
  const store: KeyValueStore & { m: Map<string, string>; failWrites(v: boolean): void; failAll(v: boolean): void } = {
    m,
    failWrites: (v) => { failWrites = v; },
    failAll: (v) => { failAll = v; },
    async getItemAsync(k) { if (failAll) throw new Error("keystore unavailable"); return m.get(k) ?? null; },
    async setItemAsync(k, v) {
      if (failAll || failWrites) throw new Error("keystore write failed");
      // The real keystore's rule: only [A-Za-z0-9._-] in keys, and small values.
      assert.match(k, /^[A-Za-z0-9._-]+$/, `illegal SecureStore key ${k}`);
      assert.ok(v.length <= 2048, `value of ${v.length} chars is over the keystore limit`);
      m.set(k, v);
    },
    async deleteItemAsync(k) { if (failAll) throw new Error("keystore unavailable"); m.delete(k); },
  };
  return store;
}

function memoryLegacy(seed: Record<string, string> = {}) {
  const m = new Map(Object.entries(seed));
  const store: LegacyStore & { m: Map<string, string> } = {
    m,
    async getItem(k) { return m.get(k) ?? null; },
    async setItem(k, v) { m.set(k, v); },
    async removeItem(k) { m.delete(k); },
  };
  return store;
}

function sessionJson(access: string, refresh: string, expiresInSec: number, pad = 0) {
  return JSON.stringify({
    access_token: access + "x".repeat(pad),
    refresh_token: refresh,
    token_type: "bearer",
    expires_in: expiresInSec,
    expires_at: Math.floor(Date.now() / 1000) + expiresInSec,
    user: { id: "user-1", email: "user@example.test", aud: "authenticated", role: "authenticated" },
  });
}

describe("chunked keystore values", () => {
  test("a value is split under the keystore limit and read back exactly", async () => {
    const ks = memoryKeystore();
    const big = "é".repeat(CHUNK_CHARS * 2 + 17); // multi-byte, three chunks
    await writeChunked(ks, KEY, big);
    assert.equal(await readChunked(ks, KEY), big);
    assert.equal(splitIntoChunks(big).length, 3);
  });

  test("an overwrite goes to the other slot and cleans up the old one", async () => {
    const ks = memoryKeystore();
    await writeChunked(ks, KEY, "a".repeat(CHUNK_CHARS * 3));
    await writeChunked(ks, KEY, "short");
    assert.equal(await readChunked(ks, KEY), "short");
    // meta + one chunk; the three old chunks are gone
    assert.equal(ks.m.size, 2, [...ks.m.keys()].join(","));
  });

  test("a write that dies half-way leaves the PREVIOUS value readable, never garbage", async () => {
    const ks = memoryKeystore();
    await writeChunked(ks, KEY, "old-session");
    const realSet = ks.setItemAsync.bind(ks);
    let writes = 0;
    ks.setItemAsync = async (k, v) => { if (++writes === 2) throw new Error("killed"); return realSet(k, v); };
    await assert.rejects(writeChunked(ks, KEY, "n".repeat(CHUNK_CHARS * 2)));
    ks.setItemAsync = realSet;
    assert.equal(await readChunked(ks, KEY), "old-session");
  });

  test("missing chunks read as absent, not as a corrupt session", async () => {
    const ks = memoryKeystore();
    await writeChunked(ks, KEY, "z".repeat(CHUNK_CHARS + 5));
    ks.m.delete([...ks.m.keys()].find((k) => k.endsWith("a1"))!);
    assert.equal(await readChunked(ks, KEY), null);
  });
});

describe("migration from AsyncStorage", () => {
  test("an existing session is moved on first read: same value, old copy removed only after", async () => {
    const legacy = memoryLegacy({ [KEY]: "legacy-session" });
    const ks = memoryKeystore();
    const s = createSecureSessionStorage(ks, legacy);
    assert.equal(await s.getItem(KEY), "legacy-session");
    assert.equal(await readChunked(ks, KEY), "legacy-session");
    assert.equal(legacy.m.has(KEY), false, "the plaintext copy was left behind");
  });

  test("if the keystore write fails, the user stays signed in on the old copy", async () => {
    const legacy = memoryLegacy({ [KEY]: "legacy-session" });
    const ks = memoryKeystore();
    ks.failWrites(true);
    const s = createSecureSessionStorage(ks, legacy);
    assert.equal(await s.getItem(KEY), "legacy-session");
    assert.equal(legacy.m.get(KEY), "legacy-session", "the only copy was deleted");
  });

  test("if the keystore is unavailable altogether, reads and writes use the old place", async () => {
    const legacy = memoryLegacy({ [KEY]: "legacy-session" });
    const ks = memoryKeystore();
    ks.failAll(true);
    const s = createSecureSessionStorage(ks, legacy);
    assert.equal(await s.getItem(KEY), "legacy-session");
    await s.setItem(KEY, "refreshed");
    assert.equal(legacy.m.get(KEY), "refreshed");
  });

  test("a failed keystore write never lets an older secure copy shadow the new value", async () => {
    const legacy = memoryLegacy();
    const ks = memoryKeystore();
    const s = createSecureSessionStorage(ks, legacy);
    await s.setItem(KEY, "session-v1");
    ks.failWrites(true);
    await s.setItem(KEY, "session-v2-rotated-refresh-token");
    ks.failWrites(false);
    assert.equal(await s.getItem(KEY), "session-v2-rotated-refresh-token");
  });

  test("sign-out removes the session from BOTH places", async () => {
    const legacy = memoryLegacy({ [KEY]: "legacy-session" });
    const ks = memoryKeystore();
    const s = createSecureSessionStorage(ks, legacy);
    await writeChunked(ks, KEY, "secure-session");
    await s.removeItem(KEY);
    assert.equal(await s.getItem(KEY), null);
    assert.equal(ks.m.size, 0);
  });
});

describe("with the real supabase-js client", () => {
  const realFetch = globalThis.fetch;
  afterEach(() => { globalThis.fetch = realFetch; });

  function client(storage: ReturnType<typeof createSecureSessionStorage>) {
    return createClient(URL_BASE, "anon-key", {
      auth: { storage, storageKey: KEY, persistSession: true, autoRefreshToken: false, detectSessionInUrl: false },
      global: { fetch: resilientAuthFetch },
    });
  }

  test("a user signed in on the OLD build is still signed in after updating", async () => {
    const legacy = memoryLegacy({ [KEY]: sessionJson("access-1", "refresh-1", 3600, 3000) });
    const ks = memoryKeystore();
    const { data } = await client(createSecureSessionStorage(ks, legacy)).auth.getSession();
    assert.equal(data.session?.refresh_token, "refresh-1", "the update signed the user out");
    assert.equal(legacy.m.has(KEY), false);
    assert.ok(await readChunked(ks, KEY));
  });

  test("a refresh answered with 500 still keeps the session (spurious-logout guard intact)", async () => {
    const legacy = memoryLegacy({ [KEY]: sessionJson("old-access", "refresh-1", -60) });
    const ks = memoryKeystore();
    globalThis.fetch = (async () =>
      new Response(JSON.stringify({ message: "db timeout" }), { status: 500 })) as typeof fetch;
    const storage = createSecureSessionStorage(ks, legacy);
    await client(storage).auth.getSession();
    assert.ok(await storage.getItem(KEY), "a 500 on refresh deleted the session");
  });

  test("a successful refresh is written to the keystore, not AsyncStorage", async () => {
    const legacy = memoryLegacy({ [KEY]: sessionJson("old-access", "refresh-1", -60) });
    const ks = memoryKeystore();
    globalThis.fetch = (async () => new Response(sessionJson("new-access", "refresh-2", 3600), {
      status: 200, headers: { "Content-Type": "application/json" },
    })) as typeof fetch;
    await client(createSecureSessionStorage(ks, legacy)).auth.getSession();
    assert.match((await readChunked(ks, KEY)) ?? "", /refresh-2/);
    assert.equal(legacy.m.has(KEY), false);
  });
});
