import { test } from "node:test";
import assert from "node:assert/strict";

import {
  dedupePackageMatchesByPerson,
  groupBuddyMatchesByUser,
  groupMatchesByPerson,
  groupPackageMatchesByPerson,
  moreListingsLabel,
  othersShareRoute,
} from "./matchDedupe.ts";

// Client, 22 Oct 2026: one sender with 3 parcels on my trip showed ONE card and
// the other two were unreachable. Search still shows one card per person, but
// every listing of that person rides along on the card (web parity).
type Any = any; // fixtures carry only the fields the helper reads
const trip = (id: string, carrierId?: string): Any => ({ id, type: "carrier_trip", carrier: carrierId ? { id: carrierId } : null });
const parcel = (id: string, senderId?: string): Any => ({ id, type: "receive_request", sender: senderId ? { id: senderId } : null });
const buddy = (id: string, userId?: string): Any => ({ id, user: userId ? { id: userId } : null });

const ids = (groups: { primary: { id: string }; others: { id: string }[] }[]) =>
  groups.map((g) => [g.primary.id, ...g.others.map((o) => o.id)]);

test("groupMatchesByPerson: one listing is one group with nothing else on it", () => {
  assert.deepEqual(ids(groupPackageMatchesByPerson([trip("t1", "u1")])), [["t1"]]);
});

test("groupMatchesByPerson: several listings of one person are one group, the rest kept in order", () => {
  const groups = groupPackageMatchesByPerson([parcel("p1", "s1"), parcel("p2", "s1"), parcel("p3", "s1")]);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].primary.id, "p1");
  assert.deepEqual(groups[0].others.map((o) => o.id), ["p2", "p3"]);
});

test("groupMatchesByPerson: preferId among the others becomes the primary", () => {
  const groups = groupPackageMatchesByPerson([trip("t1", "u1"), trip("t2", "u1"), trip("t3", "u1")], "t3");
  assert.deepEqual(ids(groups), [["t3", "t1", "t2"]]);
});

test("groupMatchesByPerson: mixed persons are one group each, in first-seen order", () => {
  const groups = groupBuddyMatchesByUser([buddy("b1", "a"), buddy("b2", "b"), buddy("b3", "a"), buddy("b4", "c"), buddy("b5", "b")]);
  assert.deepEqual(ids(groups), [["b1", "b3"], ["b2", "b5"], ["b4"]]);
});

test("groupMatchesByPerson: a listing with no person id is its own group, never merged", () => {
  assert.deepEqual(ids(groupPackageMatchesByPerson([trip("t1"), trip("t2"), trip("t3", "u1")])), [["t1"], ["t2"], ["t3"]]);
});

test("groupMatchesByPerson: primaries are exactly what the old dedupe showed", () => {
  const list = [trip("t1", "u1"), trip("t2", "u2"), trip("t3", "u1"), trip("t4", "u3"), trip("t5", "u2")];
  for (const prefer of [undefined, "t3", "t5"]) {
    assert.deepEqual(
      groupPackageMatchesByPerson(list, prefer).map((g) => g.primary.id),
      dedupePackageMatchesByPerson(list, prefer).map((m) => m.id),
    );
  }
  assert.deepEqual(ids(groupMatchesByPerson([{ id: "x", k: "1" }, { id: "y", k: "1" }], (m) => m.k)), [["x", "y"]]);
});

test("moreListingsLabel: noun from the match type, plural from the count (same words as web)", () => {
  assert.equal(moreListingsLabel(1, "carrier_trip", true), "+1 more trip on this route");
  assert.equal(moreListingsLabel(2, "receive_request", true), "+2 more parcels on this route");
  assert.equal(moreListingsLabel(3, "travel_buddy", false), "+3 more travel buddy listings");
  const primary = { from_city: "Austin", to_city: "Mumbai" };
  assert.equal(othersShareRoute(primary, [{ from_city: "Austin", to_city: "Mumbai" }]), true);
  assert.equal(othersShareRoute(primary, [{ from_city: "Austin", to_city: "Delhi" }]), false);
});
