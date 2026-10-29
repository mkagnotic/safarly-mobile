import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { allowCall, resetLoopBreaker, LOOP_LIMIT_WRITE, LOOP_LIMIT_READ, LOOP_WINDOW_MS, LOOP_COOLDOWN_MS } from "./loopBreaker.ts";

beforeEach(() => resetLoopBreaker());

test("the 29 Oct push-token storm (4 calls/s) is stopped within the first window", () => {
  let allowed = 0;
  for (let i = 0; i < 80; i++) if (allowCall("POST", "/user-handler/me/push-token", 1000 + i * 250)) allowed++;
  assert.equal(allowed, LOOP_LIMIT_WRITE);
});

test("normal use is never blocked: a write every 2s, a read every 0.5s", () => {
  for (let i = 0; i < 60; i++) assert.equal(allowCall("POST", "/message-handler/conversations/c1/messages", i * 2000), true);
  for (let i = 0; i < 60; i++) assert.equal(allowCall("GET", "/booking-handler", i * 500), true);
});

test("reads get a higher ceiling than writes", () => {
  let ok = 0;
  for (let i = 0; i < 150; i++) if (allowCall("GET", "/user-handler/me", 5000 + i * 10)) ok++;
  assert.equal(ok, LOOP_LIMIT_READ);
});

test("the block lifts after the cool-down", () => {
  for (let i = 0; i <= LOOP_LIMIT_WRITE; i++) allowCall("POST", "/x", i);
  assert.equal(allowCall("POST", "/x", 100), false);
  assert.equal(allowCall("POST", "/x", LOOP_COOLDOWN_MS + 200), true);
});

test("query strings do not split one endpoint into many", () => {
  for (let i = 0; i <= LOOP_LIMIT_READ; i++) allowCall("GET", `/search?page=${i}`, i);
  assert.equal(allowCall("GET", "/search?page=999", 50), false);
});

test("separate endpoints do not affect each other", () => {
  for (let i = 0; i <= LOOP_LIMIT_WRITE; i++) allowCall("POST", "/a", i);
  assert.equal(allowCall("POST", "/b", 20), true);
  assert.ok(LOOP_WINDOW_MS >= 10_000);
});

test("client.ts runs every JSON request through the breaker", () => {
  const src = readFileSync(new URL("./client.ts", import.meta.url), "utf8");
  assert.match(src, /if \(!allowCall\(method, path\)\) \{/);
});
