import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { BUDDY_ENTRY_ID, buddyEntryLabel, isBuddyEntrySelected, switcherEntryCount, type BuddyEntry } from "./buddyEntry.ts";
import { dealContextLine } from "./dealContext.ts";
import { labelDeals, selectableDeals } from "./dealLabel.ts";

// The chat's deal switcher + "This step is for ..." line, as one pure decision -
// the same rules web uses (ChatDealSwitcher / ChatPinnedArea / useOfferTimeline).

const deal = (id: string, opts: { state?: string; status?: string; to?: string; role?: "carrier" | "sender" } = {}) => ({
  active_deal: {
    carrier_request_id: id,
    request_status: opts.status ?? "pending",
    viewer_role: opts.role ?? "sender",
    parcel: { from_city: "Mumbai", to_city: opts.to ?? "Newark", category: "documents" },
  },
  workflow: { state: opts.state ?? "MATCH_REQUESTED" },
});

const buddy: BuddyEntry = {
  kind: "buddy", id: "buddy", listing_id: "l1", listing_owner_id: "u2",
  from_city: "Mumbai", to_city: "San Francisco", travel_date: "2026-10-26", travel_date_to: null,
  request: null, connection: null, state: "none",
};

/** What the chat would show: chip count (0 = no switcher) and the context line. */
function view(deals: ReturnType<typeof deal>[], selected: string | null, b: BuddyEntry | null, buddySelected = false) {
  const shown = selectableDeals(deals, selected);
  const entries = switcherEntryCount(shown.length, b);
  const line = dealContextLine({ selectableCount: shown.length, hasBuddy: !!b, buddySelected });
  const text =
    line === "buddy" && b ? buddyEntryLabel(b)
    : line === "deal" ? labelDeals(deals).get(selected ?? "")?.full ?? null
    : null;
  return { chips: entries >= 2 ? entries : 0, line: text };
}

describe("which deals the switcher lists", () => {
  test("a single deal shows no switcher and no line", () => {
    assert.deepEqual(view([deal("a")], "a", null), { chips: 0, line: null });
  });

  test("two live trip+parcel pairs show two chips and name the selected one", () => {
    const v = view([deal("a", { to: "Newark" }), deal("b", { to: "New York" })], "a", null);
    assert.equal(v.chips, 2);
    assert.ok(v.line && v.line.includes("Newark"), String(v.line));
  });

  test("a cancelled deal beside a live one is hidden - so no switcher and no line", () => {
    const v = view([deal("a"), deal("b", { state: "CANCELLED" })], "a", null);
    assert.deepEqual(v, { chips: 0, line: null });
  });

  test("a delivered (COMPLETED) deal still counts - its rating step lives there", () => {
    assert.equal(view([deal("a"), deal("b", { state: "COMPLETED" })], "a", null).chips, 2);
  });

  test("a finished deal stays listed while it is the one on screen", () => {
    assert.equal(view([deal("a"), deal("b", { status: "withdrawn" })], "b", null).chips, 2);
  });
});

describe("the travel-buddy entry", () => {
  test("one deal + a buddy entry shows the switcher, but does NOT name the lone deal (web rule)", () => {
    assert.deepEqual(view([deal("a")], "a", buddy, false), { chips: 2, line: null });
  });

  test("selecting the buddy entry names it", () => {
    assert.deepEqual(view([deal("a")], "a", buddy, true), {
      chips: 2,
      line: "Travel buddy · Mumbai → San Francisco · Oct 26",
    });
  });

  test("a buddy entry alone is not a choice", () => {
    assert.deepEqual(view([], null, buddy, true), { chips: 0, line: null });
  });

  test("a tapped chip wins over the default; the buddy id selects the buddy entry", () => {
    const base = { buddy, serverSelectedDealId: "a", openedFromBuddyCard: false };
    assert.equal(isBuddyEntrySelected({ ...base, wantedId: BUDDY_ENTRY_ID }), true);
    assert.equal(isBuddyEntrySelected({ ...base, wantedId: "a" }), false);
    // A link that named a deal (`?deal=`) is a choice too - it never opens the buddy entry.
    assert.equal(isBuddyEntrySelected({ ...base, buddy: { ...buddy, state: "pending_received" }, wantedId: "b" }), false);
  });
});

describe("dealContextLine", () => {
  test("no switcher, no line", () => {
    assert.equal(dealContextLine({ selectableCount: 1, hasBuddy: false, buddySelected: false }), null);
    assert.equal(dealContextLine({ selectableCount: 0, hasBuddy: true, buddySelected: true }), null);
  });
  test("two deals name the deal", () => {
    assert.equal(dealContextLine({ selectableCount: 2, hasBuddy: false, buddySelected: false }), "deal");
    assert.equal(dealContextLine({ selectableCount: 2, hasBuddy: true, buddySelected: false }), "deal");
  });
  test("the buddy entry names itself when selected", () => {
    assert.equal(dealContextLine({ selectableCount: 1, hasBuddy: true, buddySelected: true }), "buddy");
  });
});
