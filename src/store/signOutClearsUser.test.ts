import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * FENCE: signing out must not leave the previous person's data on the device.
 *
 * The store is persisted to AsyncStorage, so anything `logout()` fails to clear
 * survives into the NEXT account on a shared phone. On 6 October 2026 exactly
 * this shape — a session that outlived its sign-out — let a second person on a
 * shared phone land in the first person's Safarly account via Google.
 *
 * Source-level rather than runtime: `useAppStore` imports through the `@/`
 * alias, which bare `node --test` cannot resolve, and the alternative to a
 * source fence here is no fence at all.
 */

const SRC = readFileSync("src/store/useAppStore.ts", "utf8");

/** The `logout:` action body. */
const LOGOUT = (() => {
  const i = SRC.indexOf("logout: () =>");
  assert.ok(i !== -1, "logout action not found — has it been renamed?");
  return SRC.slice(i, SRC.indexOf("),", i));
})();

/** Keys inside `partialize`, i.e. what actually reaches the disk. */
const PERSISTED = (() => {
  const block = SRC.slice(SRC.indexOf("partialize:"));
  return [...block.slice(0, block.indexOf("}")).matchAll(/(\w+): state\./g)].map((m) => m[1]);
})();

describe("logout() clears what belongs to the account", () => {
  test("the auth flags are reset", () => {
    assert.match(LOGOUT, /authenticated: false/);
    assert.match(LOGOUT, /profileSetupDone: false/);
  });

  test("the previous person's identity and payment details are dropped", () => {
    assert.match(LOGOUT, /userProfile: defaultUserProfile/);
    assert.match(LOGOUT, /paymentMethods: \[\]/);
  });

  test("transient per-account UI state is dropped", () => {
    assert.match(LOGOUT, /kycWelcomePending: false/);
    assert.match(LOGOUT, /pendingNotice: null/);
  });

  test("device-scoped settings SURVIVE — no replayed onboarding for the next user", () => {
    assert.ok(!/\bonboarded:/.test(LOGOUT), "onboarded describes the device, not the account");
    assert.ok(!/\bshowLiveData:/.test(LOGOUT), "showLiveData describes the device");
  });
});

describe("every persisted key has a decision attached", () => {
  /** Describes the DEVICE — deliberately survives a sign-out. */
  const KEPT = new Set(["onboarded", "showLiveData", "language", "timeFormat", "timeZone"]);

  /**
   * Belongs to the ACCOUNT. Either `logout()` clears it, or it is inert mock
   * state no screen reads. `walletBalance` and the seed collections are the
   * latter: prototype data left in the store, rendered only by
   * `ReviewPayScreen`, which nothing navigates to and which cannot pay
   * (`showLiveData` is false by default, so its balance reads 0).
   */
  const ACCOUNT_SCOPED = new Set([
    "authenticated", "profileSetupDone", "kycWelcomePending", "userProfile",
    "paymentMethods", "walletBalance", "parcels", "trips", "messages",
    "notifications", "bookings", "disputes", "bids", "opportunities",
    "safetyAlerts",
  ]);

  test("partialize is readable", () => {
    assert.ok(PERSISTED.length > 0, "could not parse partialize");
  });

  test("no persisted field is undeclared", () => {
    const undecided = PERSISTED.filter((k) => !KEPT.has(k) && !ACCOUNT_SCOPED.has(k));
    assert.deepEqual(
      undecided,
      [],
      "These are written to AsyncStorage but nobody has decided whether a " +
        "sign-out clears them. Add each to KEPT (device-scoped) or to " +
        "ACCOUNT_SCOPED and clear it in logout(): " + undecided.join(", "),
    );
  });
});
