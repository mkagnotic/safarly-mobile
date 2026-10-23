import assert from "node:assert/strict";
import { test } from "node:test";

import { createSingleFlight } from "./singleFlight.ts";

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((r) => { resolve = r; });
  return { promise, resolve };
}

test("a request during a fetch is NOT dropped: one trailing run follows", async () => {
  // The bug: the match was saved after the first fetch read the DB; the event
  // that said so joined that fetch and nothing ever ran again.
  const flight = createSingleFlight();
  const seen: string[] = [];
  const gate = deferred();
  let db = "pending";
  const first = flight.run(async () => { await gate.promise; seen.push(`read:${"pending"}`); });
  db = "matched";
  const second = flight.run(async () => { seen.push(`read:${db}`); });
  gate.resolve();
  await Promise.all([first, second]);
  assert.deepEqual(seen, ["read:pending", "read:matched"]);
});

test("a burst costs at most two fetches, and the LATEST task wins", async () => {
  const flight = createSingleFlight();
  const ran: number[] = [];
  const gate = deferred();
  const p0 = flight.run(async () => { await gate.promise; ran.push(0); });
  const rest = [1, 2, 3, 4].map((n) => flight.run(async () => { ran.push(n); }));
  gate.resolve();
  await Promise.all([p0, ...rest]);
  assert.deepEqual(ran, [0, 4]);
});

test("every caller's promise settles after the final run (pull-to-refresh sees fresh data)", async () => {
  const flight = createSingleFlight();
  let value = 0;
  const gate = deferred();
  const a = flight.run(async () => { await gate.promise; value = 1; });
  const b = flight.run(async () => { value = 2; });
  gate.resolve();
  await a;
  assert.equal(value, 2);
  await b;
});

test("busy reflects a running fetch and clears after", async () => {
  const flight = createSingleFlight();
  assert.equal(flight.busy, false);
  const gate = deferred();
  const p = flight.run(() => gate.promise);
  assert.equal(flight.busy, true);
  gate.resolve();
  await p;
  assert.equal(flight.busy, false);
});

test("a failing first run still lets the queued run happen; only a failing LAST run rejects", async () => {
  const flight = createSingleFlight();
  const gate = deferred();
  let ranSecond = false;
  const a = flight.run(async () => { await gate.promise; throw new Error("first"); });
  const b = flight.run(async () => { ranSecond = true; });
  gate.resolve();
  await Promise.all([a, b]);
  assert.equal(ranSecond, true);
  await assert.rejects(flight.run(async () => { throw new Error("last"); }), /last/);
  assert.equal(flight.busy, false);
});

test("sequential calls each run (nothing is cached)", async () => {
  const flight = createSingleFlight();
  let n = 0;
  await flight.run(async () => { n += 1; });
  await flight.run(async () => { n += 1; });
  assert.equal(n, 2);
});
