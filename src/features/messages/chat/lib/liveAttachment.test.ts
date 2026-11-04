import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { liveRowNeedsSignedFetch } from "./liveAttachment.ts";

const read = (rel: string) => readFileSync(new URL(`../../../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Client, 4 Nov 2026: handoff decline photos (and any photo the other side sends
// while the chat is open) showed as black boxes - the live row holds a storage path.
test("a live row with a storage-path attachment needs the signed refetch", () => {
  assert.equal(liveRowNeedsSignedFetch({ attachment_url: "2b7118d6/handoff-rejection-1.jpg" }), true);
  assert.equal(liveRowNeedsSignedFetch({ attachment_url: "https://x.supabase.co/storage/v1/object/sign/a.jpg?token=t" }), false);
  assert.equal(liveRowNeedsSignedFetch({ attachment_url: null }), false);
  assert.equal(liveRowNeedsSignedFetch({}), false);
  assert.equal(liveRowNeedsSignedFetch(undefined), false);
});

test("the chat hook refetches instead of appending such a row, once per burst", () => {
  const s = read("src/hooks/api/useChatMessages.ts");
  assert.ok(s.includes("if (liveRowNeedsSignedFetch(incoming)) {"));
  assert.ok(s.includes("if (signedRefetchTimer.current) clearTimeout(signedRefetchTimer.current);"));
  assert.ok(s.includes("void refetch();\n            }, 400);"));
  assert.ok(s.includes("setServerMessages((prev) => applyMessageInsert(prev, incoming));"));
});
