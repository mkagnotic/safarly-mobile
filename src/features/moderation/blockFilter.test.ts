import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  addId,
  buddyRequestSenderIds,
  buildHiddenUserIds,
  isHiddenOwner,
  packageMatchOwnerIds,
  removeId,
  withoutBlocked,
} from "./blockFilter.ts";

// App Store guideline 1.2: once someone is blocked, their listings must vanish
// for the blocker - and, because blocking is mutual for visibility, the
// blocker's listings vanish for them too. These fences pin the set arithmetic
// and the "fail open" shape (no data hides nothing).

describe("buildHiddenUserIds", () => {
  test("is the union of who I blocked and who blocked me", () => {
    const hidden = buildHiddenUserIds({
      blocked_user_ids: ["a", "b"],
      blocked_by_user_ids: ["b", "c"],
    });
    assert.deepEqual([...hidden].sort(), ["a", "b", "c"]);
  });

  test("missing or failed data hides nobody", () => {
    assert.equal(buildHiddenUserIds(null).size, 0);
    assert.equal(buildHiddenUserIds(undefined).size, 0);
    assert.equal(buildHiddenUserIds({}).size, 0);
    assert.equal(buildHiddenUserIds({ blocked_user_ids: null, blocked_by_user_ids: null }).size, 0);
  });

  test("ignores empty ids", () => {
    assert.equal(buildHiddenUserIds({ blocked_user_ids: [""] }).size, 0);
  });
});

describe("isHiddenOwner", () => {
  const hidden = new Set(["x"]);

  test("matches a single owner id", () => {
    assert.equal(isHiddenOwner("x", hidden), true);
    assert.equal(isHiddenOwner("y", hidden), false);
  });

  test("matches when any of several candidate ids is hidden", () => {
    assert.equal(isHiddenOwner([undefined, null, "x"], hidden), true);
    assert.equal(isHiddenOwner([undefined, "y"], hidden), false);
  });

  test("an item with no owner id is never hidden", () => {
    assert.equal(isHiddenOwner(undefined, hidden), false);
    assert.equal(isHiddenOwner(null, hidden), false);
    assert.equal(isHiddenOwner("", hidden), false);
    assert.equal(isHiddenOwner([], hidden), false);
  });
});

describe("withoutBlocked", () => {
  const trips = [
    { id: "t1", carrier_id: "alice" },
    { id: "t2", carrier_id: "bob" },
    { id: "t3", carrier: { id: "carol" } },
  ];
  const ownerOf = (t: { carrier_id?: string; carrier?: { id: string } }) => [
    t.carrier_id,
    t.carrier?.id,
  ];

  test("drops items owned by a hidden user, by any owner field", () => {
    const kept = withoutBlocked(trips, new Set(["bob", "carol"]), ownerOf);
    assert.deepEqual(kept.map((t) => t.id), ["t1"]);
  });

  test("returns the same array when nothing is hidden (fail open, no re-render)", () => {
    assert.equal(withoutBlocked(trips, new Set(), ownerOf), trips);
  });

  test("returns the same array when no item matched", () => {
    assert.equal(withoutBlocked(trips, new Set(["zed"]), ownerOf), trips);
  });

  test("does not mutate the input", () => {
    const copy = [...trips];
    withoutBlocked(trips, new Set(["alice"]), ownerOf);
    assert.deepEqual(trips, copy);
  });
});

describe("optimistic id edits", () => {
  test("addId appends once", () => {
    assert.deepEqual(addId(["a"], "b"), ["a", "b"]);
    assert.deepEqual(addId(["a", "b"], "b"), ["a", "b"]);
  });

  test("removeId drops every copy and leaves the rest", () => {
    assert.deepEqual(removeId(["a", "b", "a"], "a"), ["b"]);
    assert.deepEqual(removeId(["a"], "z"), ["a"]);
  });
});

describe("owner accessors", () => {
  const hidden = new Set(["blocked"]);

  test("a carrier trip is hidden by its carrier", () => {
    const row = { type: "carrier_trip", carrier: { id: "blocked" } };
    assert.equal(isHiddenOwner(packageMatchOwnerIds(row), hidden), true);
  });

  test("a receive request is hidden by its sender, never by a carrier on it", () => {
    const bySender = { type: "receive_request", sender: { id: "blocked" } };
    const byCarrier = { type: "receive_request", sender: { id: "ok" }, carrier: { id: "blocked" } };
    assert.equal(isHiddenOwner(packageMatchOwnerIds(bySender), hidden), true);
    assert.equal(isHiddenOwner(packageMatchOwnerIds(byCarrier), hidden), false);
  });

  test("a buddy request is hidden by whichever sender field the server filled", () => {
    assert.equal(isHiddenOwner(buddyRequestSenderIds({ requester_id: "blocked" }), hidden), true);
    assert.equal(isHiddenOwner(buddyRequestSenderIds({ user_profiles: { id: "blocked" } }), hidden), true);
    assert.equal(isHiddenOwner(buddyRequestSenderIds({ sender_id: "ok" }), hidden), false);
  });
});
