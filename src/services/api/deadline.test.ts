import assert from "node:assert/strict";
import { afterEach, beforeEach, mock, test } from "node:test";

import { abortable, withDeadline } from "./deadline.ts";

/**
 * The deadline every API request runs under. Fake timers, so a 45s deadline is
 * tested without waiting 45s. A request that never answers is modelled as a
 * fetch that only settles when its signal aborts — exactly what a hung socket
 * does with a real fetch.
 */

class TimeoutErr extends Error {
  constructor() {
    super("The request timed out. Please try again.");
    this.name = "TimeoutErr";
  }
}
const onTimeout = () => new TimeoutErr();

/** A fetch that never answers, but rejects with AbortError when aborted (real fetch behaviour). */
function hungFetch(signal: AbortSignal): Promise<never> {
  return new Promise((_, reject) => {
    const fail = () => {
      const e = new Error("Aborted");
      e.name = "AbortError";
      reject(e);
    };
    // Real fetch rejects at once when handed an already-aborted signal.
    if (signal.aborted) fail();
    else signal.addEventListener("abort", fail);
  });
}

/** Flush pending promise callbacks between fake-timer ticks. */
const flush = () => new Promise<void>((resolve) => setImmediate(resolve));

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

test("a request that never answers fails with the timeout error at the deadline, not before", async () => {
  let settled: unknown = "pending";
  const p = withDeadline((s) => hungFetch(s), 45_000, undefined, onTimeout).catch((e) => e);
  void p.then((v) => { settled = v; });

  mock.timers.tick(44_999);
  await flush();
  assert.equal(settled, "pending", "must not give up early");

  mock.timers.tick(1);
  await flush();
  assert.ok(settled instanceof TimeoutErr, "times out at 45s with the timeout error");
});

test("a fast response is returned untouched and the timer is cleared", async () => {
  const result = await withDeadline(async () => "ok", 45_000, undefined, onTimeout);
  assert.equal(result, "ok");
  // Nothing left to fire: advancing past the deadline must not throw anywhere.
  mock.timers.tick(60_000);
});

test("a slow but successful response (just under the deadline) succeeds", async () => {
  const p = withDeadline(
    (s) => new Promise<string>((resolve, reject) => {
      const t = setTimeout(() => resolve("late but fine"), 44_000);
      s.addEventListener("abort", () => { clearTimeout(t); reject(new Error("aborted")); });
    }),
    45_000, undefined, onTimeout,
  );
  mock.timers.tick(44_000);
  assert.equal(await p, "late but fine");
});

test("a caller's own cancel stays an AbortError (screens swallow it), never the timeout error", async () => {
  const caller = new AbortController();
  const p = withDeadline((s) => hungFetch(s), 45_000, caller.signal, onTimeout).catch((e) => e);
  caller.abort();
  const err = await p;
  assert.equal((err as Error).name, "AbortError");
  assert.ok(!(err instanceof TimeoutErr));
});

test("an already-cancelled caller signal aborts immediately without a network call hanging", async () => {
  const caller = new AbortController();
  caller.abort();
  let ran = false;
  const err = await withDeadline(async (s) => { ran = true; return hungFetch(s); }, 45_000, caller.signal, onTimeout).catch((e) => e);
  assert.ok(ran);
  assert.equal((err as Error).name, "AbortError");
});

test("server errors pass through unchanged (they are not timeouts)", async () => {
  const boom = new Error("Request failed with status 500");
  const err = await withDeadline(async () => { throw boom; }, 45_000, undefined, onTimeout).catch((e) => e);
  assert.equal(err, boom);
});

test("one deadline covers the 401 refresh-and-retry: a refresh that hangs still ends at 45s total", async () => {
  // First call answers 401 after 10s, then the token refresh never answers.
  let settled: unknown = "pending";
  const neverRefresh = new Promise<boolean>(() => {});
  const p = withDeadline(async (s) => {
    await new Promise((r) => setTimeout(r, 10_000)); // the 401 round trip
    await abortable(neverRefresh, s);                // refresh hangs
    return "unreachable";
  }, 45_000, undefined, onTimeout).catch((e) => e);
  void p.then((v) => { settled = v; });

  mock.timers.tick(10_000);
  await flush();
  mock.timers.tick(34_999);
  await flush();
  assert.equal(settled, "pending");
  mock.timers.tick(1);
  await flush();
  assert.ok(settled instanceof TimeoutErr, "total time is bounded by ONE deadline, not 45s per step");
});

test("reading the body is covered too: headers arrive, body stalls, still times out", async () => {
  let settled: unknown = "pending";
  const stalledBody = new Promise<string>(() => {});
  const p = withDeadline(async (s) => abortable(stalledBody, s), 45_000, undefined, onTimeout).catch((e) => e);
  void p.then((v) => { settled = v; });
  mock.timers.tick(45_000);
  await flush();
  assert.ok(settled instanceof TimeoutErr);
});

test("abortable resolves normally when the work finishes first, and rejects AbortError when aborted first", async () => {
  const c1 = new AbortController();
  assert.equal(await abortable(Promise.resolve(7), c1.signal), 7);

  const c2 = new AbortController();
  const p = abortable(new Promise(() => {}), c2.signal).catch((e) => e);
  c2.abort();
  assert.equal(((await p) as Error).name, "AbortError");

  const c3 = new AbortController();
  c3.abort();
  assert.equal(((await abortable(Promise.resolve(1), c3.signal).catch((e) => e)) as Error).name, "AbortError");
});

test("does not leak listeners on the caller's signal after finishing", async () => {
  const caller = new AbortController();
  let added = 0;
  let removed = 0;
  const realAdd = caller.signal.addEventListener.bind(caller.signal);
  const realRemove = caller.signal.removeEventListener.bind(caller.signal);
  caller.signal.addEventListener = ((...a: Parameters<typeof realAdd>) => { added++; return realAdd(...a); }) as typeof realAdd;
  caller.signal.removeEventListener = ((...a: Parameters<typeof realRemove>) => { removed++; return realRemove(...a); }) as typeof realRemove;
  await withDeadline(async () => "done", 45_000, caller.signal, onTimeout);
  assert.equal(added, removed);
});
