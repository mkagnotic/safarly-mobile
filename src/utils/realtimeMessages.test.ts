import { test } from "node:test";
import assert from "node:assert/strict";

import { applyMessageInsert, applyMessageUpdate } from "./realtimeMessages.ts";

type Msg = { id: string; text: string; read_at: string | null };
const thread: Msg[] = [
  { id: "a", text: "hi", read_at: null },
  { id: "b", text: "there", read_at: "2026-10-12T10:00:00Z" },
];

test("an update for a row this thread never loaded keeps the same array", () => {
  assert.equal(applyMessageUpdate(thread, { id: "zzz", read_at: "x" }), thread);
});

test("an update that changes nothing keeps the same array (the render-loop trigger)", () => {
  assert.equal(applyMessageUpdate(thread, { id: "b", read_at: "2026-10-12T10:00:00Z" }), thread);
});

test("a real change replaces only that row", () => {
  const next = applyMessageUpdate(thread, { id: "a", read_at: "2026-10-12T11:00:00Z" });
  assert.notEqual(next, thread);
  assert.equal(next[0].read_at, "2026-10-12T11:00:00Z");
  assert.equal(next[0].text, "hi");
  assert.equal(next[1], thread[1]);
});

test("an event without an id is ignored", () => {
  assert.equal(applyMessageUpdate(thread, undefined), thread);
  assert.equal(applyMessageInsert(thread, { text: "x" }), thread);
});

test("an insert already in the thread (our own echo) keeps the same array", () => {
  assert.equal(applyMessageInsert(thread, { id: "a", text: "hi", read_at: null }), thread);
});

test("a new insert is appended", () => {
  const next = applyMessageInsert(thread, { id: "c", text: "new", read_at: null });
  assert.equal(next.length, 3);
  assert.equal(next[2].id, "c");
});
