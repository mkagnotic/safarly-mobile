import { test } from "node:test";
import assert from "node:assert/strict";

import { createPressLock } from "./pressLock.ts";

test("a second tap while the first is running is ignored", () => {
  const timers: (() => void)[] = [];
  const lock = createPressLock(800, (fn) => timers.push(fn));
  let calls = 0;
  assert.equal(lock.press(() => void calls++), true);
  assert.equal(lock.press(() => void calls++), false, "double tap must not run twice");
  assert.equal(calls, 1);
  timers.forEach((t) => t()); // the fallback window ends
  assert.equal(lock.press(() => void calls++), true);
  assert.equal(calls, 2);
});

test("an async handler holds the lock until its promise settles", async () => {
  const lock = createPressLock(800, () => {});
  let release!: () => void;
  const work = new Promise<void>((r) => (release = r));
  lock.press(() => work);
  assert.equal(lock.locked, true);
  assert.equal(lock.press(() => {}), false);
  release();
  await work;
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(lock.locked, false, "unlocked once the request finished");
});

test("a rejected handler unlocks too, so the user can retry", async () => {
  const lock = createPressLock(800, () => {});
  const failing = Promise.reject(new Error("network"));
  lock.press(() => failing);
  await failing.catch(() => {});
  await new Promise((r) => setTimeout(r, 0));
  assert.equal(lock.locked, false);
});

test("a handler that throws synchronously unlocks and rethrows", () => {
  const lock = createPressLock(800, () => {});
  assert.throws(() => lock.press(() => { throw new Error("bad"); }), /bad/);
  assert.equal(lock.locked, false);
});
