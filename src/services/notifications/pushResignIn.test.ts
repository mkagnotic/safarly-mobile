import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Client, 4 Nov 2026 (1.1.3 on TestFlight + Play): no push at all on the test
 * account. 1.1.2's loop fix added `registeredThisRun` ("the server already has
 * this token") but sign-out never cleared it - while sign-out DOES delete the
 * token on the server. Signing out and back in without closing the app (switching
 * test accounts, or any user doing the same) then skipped registration: production
 * showed the account with 0 push tokens while it received 12 notifications.
 */
const src = readFileSync(new URL("./push.ts", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const body = (name: string) => {
  const i = src.indexOf(`export async function ${name}(`);
  assert.ok(i >= 0, name);
  return src.slice(i, src.indexOf("\n}\n", i));
};

test("sign-out forgets that this run already registered (server dropped the token)", () => {
  assert.ok(body("forgetThisDevice").includes("resetPushRegistration();"));
  const reset = src.slice(src.indexOf("function resetPushRegistration(): void {"));
  const fn = reset.slice(0, reset.indexOf("\n}\n"));
  assert.ok(fn.includes("registeredThisRun = null;"));
  assert.ok(fn.includes("syncedFor = null;"));
});

test("account deletion clears it too", () => {
  assert.ok(body("clearCachedPushToken").includes("resetPushRegistration();"));
});

test("the loop fix stays: same token in the same signed-in run is not re-sent", () => {
  assert.ok(src.includes("if (registeredThisRun === token) return;"));
  assert.ok(src.includes("if (registering) return registering;"));
});

test("model: sign out then sign in on the same run registers again", () => {
  let registeredThisRun: string | null = null;
  const server = new Set<string>();
  const register = (t: string) => { if (registeredThisRun === t) return; server.add(t); registeredThisRun = t; };
  const forget = (t: string) => { server.delete(t); registeredThisRun = null; };
  register("tok"); forget("tok"); register("tok");
  assert.equal(server.has("tok"), true);
});
