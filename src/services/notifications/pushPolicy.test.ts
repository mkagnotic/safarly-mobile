import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { accountPushOn, devicePushState, startupPushAction } from "./pushPolicy.ts";

// Push is one account setting for every device (28 Oct 2026).
const on = { accountOn: true, granted: false, canAskAgain: true, askedBefore: false };

test("account ON + this phone already allowed: register silently on sign-in / app start", () => {
  assert.equal(startupPushAction({ ...on, granted: true }), "register");
  assert.equal(startupPushAction({ ...on, granted: true, askedBefore: true }), "register");
});

test("account ON + never asked here (every new iPhone): ask once", () => {
  assert.equal(startupPushAction(on), "ask");
});

test("asked before, or the OS can't ask: never nag - Preferences shows the notice", () => {
  assert.equal(startupPushAction({ ...on, askedBefore: true }), "none");
  assert.equal(startupPushAction({ ...on, canAskAgain: false }), "none");
});

test("account OFF: nothing is registered or asked, even if this phone allows it", () => {
  assert.equal(startupPushAction({ ...on, accountOn: false }), "none");
  assert.equal(startupPushAction({ ...on, accountOn: false, granted: true }), "none");
});

test("devicePushState: the switch is the account; the phone's permission is only the notice", () => {
  assert.equal(devicePushState({ accountOn: false, granted: true, canAskAgain: true }), "off");
  assert.equal(devicePushState({ accountOn: true, granted: true, canAskAgain: false }), "ready");
  assert.equal(devicePushState({ accountOn: true, granted: false, canAskAgain: true }), "allow");
  assert.equal(devicePushState({ accountOn: true, granted: false, canAskAgain: false }), "blocked");
});

test("accountPushOn: no preferences row means ON (server default); only false is off", () => {
  assert.equal(accountPushOn(null), true);
  assert.equal(accountPushOn({}), true);
  assert.equal(accountPushOn({ push_enabled: true }), true);
  assert.equal(accountPushOn({ push_enabled: false }), false);
});

test("the account sync uses the policy, asks the OS only for 'ask', and remembers it asked", () => {
  const src = readFileSync(new URL("./push.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function syncPushForAccount"));
  assert.match(fn, /const action = startupPushAction\(\{/);
  assert.match(fn, /if \(action === "ask"\) \{\s*await AsyncStorage\.setItem\(ASKED_ONCE_KEY, "1"\);\s*if \(\(await Notifications\.requestPermissionsAsync\(\)\)\.status !== "granted"\) return;/);
});

test("Preferences shows the account setting, not this phone's permission", () => {
  const src = readFileSync(new URL("../../features/profile/PreferencesScreen.tsx", import.meta.url), "utf8");
  assert.match(src, /const pushValue = pushAvailability === "available" && accountOn;/);
  assert.match(src, /if \(!\(await handleUpdate\(\{ push_enabled: next \}\)\)\) return;\s*if \(next\) \{/);
  const profile = readFileSync(new URL("../../hooks/api/useMyProfile.ts", import.meta.url), "utf8");
  assert.match(profile, /void syncPushForAccount\(/);
});

test("foregroundPresentation: signed out shows nothing; the open chat shows no banner; anything else shows", async () => {
  const { foregroundPresentation } = await import("./pushPolicy.ts");
  assert.deepEqual(foregroundPresentation({ signedIn: false, conversationId: "c1", activeConversationId: null }), { show: false, badge: false });
  assert.deepEqual(foregroundPresentation({ signedIn: true, conversationId: "c1", activeConversationId: "c1" }), { show: false, badge: true });
  assert.deepEqual(foregroundPresentation({ signedIn: true, conversationId: "c2", activeConversationId: "c1" }), { show: true, badge: true });
  assert.deepEqual(foregroundPresentation({ signedIn: true, conversationId: undefined, activeConversationId: "c1" }), { show: true, badge: true });
});
