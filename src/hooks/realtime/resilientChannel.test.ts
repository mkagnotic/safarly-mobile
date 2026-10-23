import assert from "node:assert/strict";
import { test } from "node:test";

import { isDeadChannelStatus, reconnectDelayMs } from "./resilientChannel.ts";

test("a channel that errored, timed out or closed is dead and must be rebuilt", () => {
  // The iPhone bug: the socket died in the background and nothing rebuilt it.
  for (const s of ["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"]) assert.equal(isDeadChannelStatus(s), true, s);
  assert.equal(isDeadChannelStatus("SUBSCRIBED"), false);
});

test("rebuild backoff: 2s, 5s, 10s, then every 30s", () => {
  assert.deepEqual([0, 1, 2, 3, 4, 9].map(reconnectDelayMs), [2000, 5000, 10000, 30000, 30000, 30000]);
  assert.equal(reconnectDelayMs(-1), 2000);
});
