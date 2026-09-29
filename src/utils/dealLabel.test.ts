import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { isDealFinished, labelDeals, roleWordFor, selectableDeals, type LabellableDeal } from "./dealLabel.ts";

// Mirrors web's `src/test/dealLabel.test.ts` - dealLabel.ts is a port of web's logic,
// so this suite exists to prove the two platforms name a delivery the same way. A
// delivery called one thing on the phone and another on the web is the same confusion
// the module exists to remove.
//
// The reported bug: Roja and Viswanath had TWO live deals in one thread, on the SAME
// route, with OPPOSITE roles. Both chips were labelled by route alone, so they
// rendered an identical string and the travel-document prompt looked misaddressed.

const deal = (
  id: string,
  viewer_role: "carrier" | "sender",
  from: string | null,
  to: string | null,
  category: string | null = null,
): LabellableDeal => ({
  active_deal: {
    carrier_request_id: id,
    viewer_role,
    parcel: from === null && to === null ? null : { from_city: from, to_city: to, category },
  },
});

const chips = (deals: LabellableDeal[]) => [...labelDeals(deals).values()].map((l) => l.chip);
const allUnique = (xs: string[]) => new Set(xs).size === xs.length;

describe("labelDeals gives every delivery in a thread a distinct name", () => {
  test("the reported case: same route, opposite roles", () => {
    const out = labelDeals([
      deal("a", "carrier", "Mumbai, MH", "New York (JFK), NY", "electronics"),
      deal("b", "sender", "Mumbai, MH", "New York (JFK), NY", "clothing"),
    ]);
    assert.equal(out.get("a")!.chip, "Carrying · Mumbai → New York (JFK)");
    assert.equal(out.get("b")!.chip, "Receiving · Mumbai → New York (JFK)");
    assert.ok(allUnique([...out.values()].map((l) => l.chip)));
  });

  test("different routes, opposite roles - the pair's second journey elsewhere", () => {
    assert.ok(
      allUnique(
        chips([
          deal("a", "carrier", "Mumbai, MH", "New York (JFK), NY", "electronics"),
          deal("b", "sender", "Bangalore, KA", "London (LHR)", "documents"),
        ]),
      ),
    );
  });

  test("same route AND same role: the category breaks the tie", () => {
    const out = labelDeals([
      deal("a", "sender", "Mumbai", "New York", "clothing"),
      deal("b", "sender", "Mumbai", "New York", "documents"),
    ]);
    assert.equal(out.get("a")!.chip, "Receiving · Mumbai → New York · Clothing");
    assert.ok(allUnique([...out.values()].map((l) => l.chip)));
  });

  test("same route, same role AND same category: falls back to the id", () => {
    const got = chips([
      deal("aaaa1111-x", "sender", "Mumbai", "New York", "clothing"),
      deal("bbbb2222-y", "sender", "Mumbai", "New York", "clothing"),
    ]);
    assert.ok(allUnique(got));
    assert.ok(got.every((c) => c.includes("#")));
  });

  // ⚠️ Found by running the real app, not by this suite: the tiebreak took the HEAD of
  // the id, so ids sharing a prefix produced two identical labels.
  test("ids sharing a PREFIX are still distinguished", () => {
    assert.ok(
      allUnique(
        chips([
          deal("eeee1111", "sender", "Mumbai", "New York", "clothing"),
          deal("eeee2222", "sender", "Mumbai", "New York", "clothing"),
        ]),
      ),
    );
  });

  test("ids sharing a prefix AND a short suffix grow the tail until unique", () => {
    assert.ok(
      allUnique(
        chips([
          deal("aaaa-0000-zzzz", "sender", "Mumbai", "New York", "clothing"),
          deal("bbbb-1111-zzzz", "sender", "Mumbai", "New York", "clothing"),
        ]),
      ),
    );
  });

  test("three identical deals are all distinct", () => {
    assert.ok(
      allUnique(
        chips([
          deal("eeee1111", "sender", "Mumbai", "New York", "clothing"),
          deal("eeee2222", "sender", "Mumbai", "New York", "clothing"),
          deal("eeee3333", "sender", "Mumbai", "New York", "clothing"),
        ]),
      ),
    );
  });

  test("does not spend detail it does not need", () => {
    assert.equal(
      chips([deal("a", "carrier", "Mumbai", "New York", "clothing")])[0],
      "Carrying · Mumbai → New York",
    );
  });

  test("is order-independent - both sides of a tie get the tiebreak", () => {
    const a = deal("aaaa1111", "sender", "Mumbai", "New York", "clothing");
    const b = deal("bbbb2222", "sender", "Mumbai", "New York", "clothing");
    assert.deepEqual(
      [...labelDeals([a, b]).values()].map((l) => l.chip).sort(),
      [...labelDeals([b, a]).values()].map((l) => l.chip).sort(),
    );
  });

  test("survives a missing or half-filled parcel", () => {
    const out = labelDeals([deal("a", "carrier", null, null), deal("b", "sender", "Mumbai", null)]);
    assert.equal(out.get("a")!.chip, "Carrying · Delivery");
    assert.equal(out.get("b")!.chip, "Receiving · Mumbai");
  });

  test("names the viewer's own side, never the counterpart's", () => {
    assert.equal(roleWordFor("carrier"), "Carrying");
    assert.equal(roleWordFor("sender"), "Receiving");
  });

  test("empty input is not a crash", () => {
    assert.equal(labelDeals([]).size, 0);
  });
});

// Found by scenario H on THIS platform: one live delivery beside a cancelled one hid
// the switcher (which filters finished deals) while the pinned context line still
// printed "This step is for ..." - announcing a choice with no control to make it.
describe("selectableDeals decides 'is there a choice' for both controls", () => {
  const withState = (id: string, role: "carrier" | "sender", status: string, state: string) => ({
    active_deal: {
      carrier_request_id: id,
      viewer_role: role,
      request_status: status,
      parcel: { from_city: "Mumbai", to_city: "New York", category: "clothing" },
    },
    workflow: { state },
  });

  test("a cancelled delivery beside a live one leaves ONE selectable", () => {
    assert.equal(
      selectableDeals(
        [withState("live", "carrier", "pending", "PRICE_OFFER"),
         withState("dead", "sender", "withdrawn", "CANCELLED")],
        "live",
      ).length,
      1,
    );
  });

  test("keeps the deal currently on screen even when it is finished", () => {
    assert.equal(
      selectableDeals(
        [withState("live", "carrier", "pending", "PRICE_OFFER"),
         withState("dead", "sender", "withdrawn", "CANCELLED")],
        "dead",
      ).length,
      2,
    );
  });

  test("rejected and archived count as finished; completed does NOT", () => {
    assert.equal(isDealFinished(withState("a", "carrier", "rejected", "PRICE_OFFER")), true);
    assert.equal(isDealFinished(withState("b", "carrier", "pending", "ARCHIVED")), true);
    assert.equal(isDealFinished(withState("c", "carrier", "accepted", "COMPLETED")), false);
  });

  test("tolerates a deal with no workflow at all", () => {
    assert.equal(isDealFinished({ active_deal: { request_status: "pending" } }), false);
  });
});
