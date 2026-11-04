import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { pendingIsOnServer } from "./pendingReconcile.ts";

const read = (rel: string) => readFileSync(new URL(`../../../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Client, 4 Nov 2026 (1.1.3 build): every message sent showed twice. The bubble
// was matched to the saved row by text + a 60 s window across two clocks.
const me = "u1";
const saved = { id: "m1", text: "hello", created_at: "2026-11-04T12:00:00.123456+00:00", from_user_id: me };

test("a bubble from a phone whose clock is 5 minutes off is matched by id", () => {
  const p = { text: "hello", created_at: "2026-11-04T12:05:00.000Z", status: "pending" };
  assert.equal(pendingIsOnServer(p, [saved], me), false); // the old guess fails
  assert.equal(pendingIsOnServer({ ...p, serverId: "m1" }, [saved], me), true);
});

test("by id it waits for its own row, never a look-alike", () => {
  const p = { text: "hello", created_at: "2026-11-04T12:00:00.000Z", status: "pending", serverId: "m2" };
  assert.equal(pendingIsOnServer(p, [saved], me), false);
  assert.equal(pendingIsOnServer({ ...p, status: "failed", serverId: "m1" }, [saved], me), false);
});

test("before the reply the text/time match still applies", () => {
  assert.equal(pendingIsOnServer({ text: "hello", created_at: "2026-11-04T12:00:05Z", status: "pending" }, [saved], me), true);
});

test("the chat hook ties the bubble to the saved row on send and retry", () => {
  const s = read("src/hooks/api/useChatMessages.ts");
  assert.ok(s.includes("const kept = pending.filter((p) => !pendingIsOnServer(p, serverMessages, currentUserId));"));
  assert.equal(s.split("adoptSaved(clientId, res?.data);").length - 1, 2);
  assert.ok(!s.includes("< 60_000"));
});
