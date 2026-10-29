import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { shouldReregisterOnTokenEvent } from "./pushPolicy.ts";

/**
 * 29 Oct 2026, prod: 1.1.1 phones called POST /me/push-token ~4 times a second.
 * expo-notifications emits "token changed" whenever the app fetches the token,
 * and the listener re-registered (= fetched again) on every event: a loop.
 */
const base = { eventToken: "dev-A", lastDeviceToken: "dev-A", registering: false, optedIn: true, granted: true };

test("the echo of our own fetch (same device token) never re-registers", () => {
  assert.equal(shouldReregisterOnTokenEvent(base), false);
});

test("any event while our registration is running is ignored", () => {
  assert.equal(shouldReregisterOnTokenEvent({ ...base, eventToken: "dev-B", registering: true }), false);
});

test("a genuinely new device token re-registers", () => {
  assert.equal(shouldReregisterOnTokenEvent({ ...base, eventToken: "dev-B" }), true);
});

test("not opted in, no permission, or no token: never", () => {
  assert.equal(shouldReregisterOnTokenEvent({ ...base, eventToken: "dev-B", optedIn: false }), false);
  assert.equal(shouldReregisterOnTokenEvent({ ...base, eventToken: "dev-B", granted: false }), false);
  assert.equal(shouldReregisterOnTokenEvent({ ...base, eventToken: null }), false);
});

test("simulated loop: our fetch's echo events never turn into more registrations", () => {
  // Model: each registration fetches the token, which emits one event with the
  // same device token. The old listener re-registered on every event.
  let registrations = 0;
  let lastDeviceToken: string | null = null;
  const emitted: string[] = [];
  const register = () => { registrations++; lastDeviceToken = "dev-A"; emitted.push("dev-A"); };
  register(); // app start
  for (let i = 0; i < 50 && emitted.length; i++) {
    const ev = emitted.shift()!;
    if (shouldReregisterOnTokenEvent({ eventToken: ev, lastDeviceToken, registering: false, optedIn: true, granted: true })) register();
  }
  assert.equal(registrations, 1);
});

const src = readFileSync(new URL("./push.ts", import.meta.url), "utf8");

test("push.ts guards the listener and coalesces registrations", () => {
  assert.match(src, /if \(registering\) return registering;/);
  assert.match(src, /\/\/ Our own token fetch emits this event: ignore the echo/);
  assert.match(src, /shouldReregisterOnTokenEvent\(\{/);
  assert.match(src, /if \(registeredThisRun === token\) return;/);
  // The old unconditional re-register must not come back.
  assert.doesNotMatch(src, /addPushTokenListener\(\(\) => \{/);
});
