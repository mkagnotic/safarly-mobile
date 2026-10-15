import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  createDeviceIdGetter,
  createSignInTracker,
  DEVICE_ID_KEY,
  newDeviceId,
  SIGNUP_WINDOW_MS,
  type KeyStore,
} from "./signInTrackingCore.ts";

// The bug these guard: the apps never called POST /auth-handler/track, so every
// app-only account showed "0 devices, 0 IPs" on the admin user page.

function memoryStore(initial: Record<string, string> = {}, broken = false): KeyStore & { data: Record<string, string> } {
  const data = { ...initial };
  return {
    data,
    async getItemAsync(k) { if (broken) throw new Error("keystore"); return data[k] ?? null; },
    async setItemAsync(k, v) { if (broken) throw new Error("keystore"); data[k] = v; },
  };
}

describe("device id", () => {
  test("is created once per install and then reused", async () => {
    const store = memoryStore();
    const id1 = await createDeviceIdGetter(store)();
    assert.match(id1, /^app-[0-9a-f]{32}$/);
    assert.equal(store.data[DEVICE_ID_KEY], id1);
    // A later launch (new getter) reads the same id back.
    assert.equal(await createDeviceIdGetter(store)(), id1);
  });

  test("replaces a malformed stored value", async () => {
    const store = memoryStore({ [DEVICE_ID_KEY]: "garbage" });
    const id = await createDeviceIdGetter(store, () => newDeviceId(() => 0.5))();
    assert.equal(id, `app-${"8".repeat(32)}`);
  });

  test("a broken keystore still yields an id for this launch", async () => {
    const id = await createDeviceIdGetter(memoryStore({}, true))();
    assert.match(id, /^app-[0-9a-f]{32}$/);
  });
});

describe("sign-in tracker", () => {
  const NOW = Date.parse("2026-10-15T10:00:00Z");
  const setup = (fail = false) => {
    const sent: Array<[string | null, string]> = [];
    const track = createSignInTracker({
      getDeviceId: async () => "app-1",
      send: async (fp, type) => { if (fail) throw new Error("offline"); sent.push([fp, type]); },
      now: () => NOW,
    });
    return { sent, track };
  };

  test("records each user once per launch, with the device id", async () => {
    const { sent, track } = setup();
    await track("u1", "2026-01-01T00:00:00Z");
    await track("u1", "2026-01-01T00:00:00Z"); // TOKEN_REFRESHED etc. re-run applySession
    await track("u2", "2026-01-01T00:00:00Z"); // account switch on the same phone
    assert.deepEqual(sent, [["app-1", "login"], ["app-1", "login"]]);
  });

  test("a brand-new account is recorded as a signup", async () => {
    const { sent, track } = setup();
    await track("u1", new Date(NOW - SIGNUP_WINDOW_MS / 2).toISOString());
    assert.deepEqual(sent, [["app-1", "signup"]]);
  });

  test("a failed send never throws and is retried on a later call", async () => {
    const { track } = setup(true);
    await assert.doesNotReject(track("u1", null));
    const ok = setup();
    await ok.track("u1", null);
    assert.deepEqual(ok.sent, [["app-1", "login"]]);
  });

  test("ignores an empty user id", async () => {
    const { sent, track } = setup();
    await track("", null);
    assert.deepEqual(sent, []);
  });
});
