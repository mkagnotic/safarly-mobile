import { test } from "node:test";
import assert from "node:assert/strict";

import { INBOX_PAGE_SIZE, hasMorePages, inboxChipCounts, mergePages } from "./inboxPaging.ts";

/**
 * The inbox must reach every thread, and its chips must count them all.
 * Found 2026-10-13: neither platform could page past the first page of
 * threads, so unread messages beyond it — counted by the tab badge — could
 * never be cleared, and the chips counted the loaded page only.
 */

test("same page size as web", () => {
  assert.equal(INBOX_PAGE_SIZE, 50);
});

test("pages by the server's real total, never by a full page", () => {
  assert.equal(hasMorePages({ page: 1, per_page: 50, total: 51 }), true);
  assert.equal(hasMorePages({ page: 2, per_page: 50, total: 100 }), false, "a full LAST page is the end");
  assert.equal(hasMorePages({ page: 1, per_page: 50, total: 3 }), false);
  assert.equal(hasMorePages(null), false);
  assert.equal(hasMorePages(undefined), false);
});

test("a thread that moved between pages while paging appears once", () => {
  const out = mergePages([[{ id: "a" }, { id: "b" }], [{ id: "b" }, { id: "c" }]]);
  assert.deepEqual(out.map((r) => r.id), ["a", "b", "c"]);
});

test("chips use the server's counts while pages remain", () => {
  assert.deepEqual(
    inboxChipCounts({ loadedAll: 50, loadedUnread: 2, hasMore: true, serverTotal: 120, serverUnreadChats: 7 }),
    { all: 120, unread: 7 },
  );
});

test("chips use the loaded rows once everything is loaded (instant optimistic read)", () => {
  assert.deepEqual(
    inboxChipCounts({ loadedAll: 12, loadedUnread: 1, hasMore: false, serverTotal: 12, serverUnreadChats: 2 }),
    { all: 12, unread: 1 },
  );
});

test("an older server without a summary still never shows fewer than the loaded rows", () => {
  assert.deepEqual(inboxChipCounts({ loadedAll: 50, loadedUnread: 3, hasMore: true }), { all: 50, unread: 3 });
});
