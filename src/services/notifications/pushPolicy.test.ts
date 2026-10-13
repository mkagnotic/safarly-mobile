import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { loginPushAction } from "./pushPolicy.ts";

test("never-asked devices (every new iPhone) are asked once on sign-in", () => {
  assert.equal(loginPushAction("undetermined"), "ask");
});

test("already-allowed devices register silently, as before", () => {
  assert.equal(loginPushAction("granted"), "register");
});

test("a user who said no is never asked again", () => {
  assert.equal(loginPushAction("denied"), "skip");
  assert.equal(loginPushAction(undefined), "skip");
});

test("the sign-in sync uses the policy and asks the OS only for 'ask'", () => {
  const src = readFileSync(new URL("./push.ts", import.meta.url), "utf8");
  const fn = src.slice(src.indexOf("export async function syncPushRegistrationOnLogin"));
  assert.match(fn, /loginPushAction\(status\)/);
  assert.match(fn, /if \(action === "ask"\) \{\s*status = \(await Notifications\.requestPermissionsAsync\(\)\)\.status;/);
});
