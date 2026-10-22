import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  BUDDY_ENTRY_ID, buddyActionToast, buddyEntryLabel, buddyPinView, buddyTripDates, isBuddyEntrySelected,
  switcherEntryCount, type BuddyEntry, type BuddyEntryState,
} from "./buddyEntry.ts";

// The travel-buddy entry in a SHARED chat (22 Oct 2026): a pair with a parcel
// deal can now ask to be travel buddies in the same chat. buddyEntry.ts is
// byte-identical to web's src/features/messages/lib/buddyEntry.ts, so these
// words are the words on both platforms.

const entry = (state: BuddyEntryState, extra: Partial<BuddyEntry> = {}): BuddyEntry => ({
  kind: "buddy",
  id: "buddy",
  listing_id: "L-1",
  listing_owner_id: "B",
  from_city: "Mumbai",
  to_city: "San Francisco",
  travel_date: "2026-10-26",
  travel_date_to: "2026-10-26",
  request: state.startsWith("pending") ? { id: "r-1", status: "pending", sender_id: "A", receiver_id: "B" } : null,
  connection: null,
  state,
  ...extra,
});

const ALL: BuddyEntryState[] = ["none", "pending_sent", "pending_received", "buddies", "completed"];

describe("buddy entry label", () => {
  test("human label: route and short date", () => {
    assert.equal(buddyEntryLabel(entry("none")), "Travel buddy · Mumbai → San Francisco · Oct 26");
  });
  test("a travel window shows both ends", () => {
    assert.equal(buddyTripDates({ travel_date: "2026-10-26", travel_date_to: "2026-10-28" }), "Oct 26 – Oct 28");
  });
  test("unknown route or date is left out, never printed as null", () => {
    assert.equal(buddyEntryLabel(entry("none", { from_city: null, travel_date: null, travel_date_to: null })), "Travel buddy");
  });
  test("a date is a calendar day, not shifted by a time zone", () => {
    assert.equal(buddyTripDates({ travel_date: "2026-11-01", travel_date_to: null }), "Nov 1");
  });
});

describe("buddy pin", () => {
  test("ask: one primary button, no secondary", () => {
    const v = buddyPinView(entry("none"), "Pratik");
    assert.equal(v.primary?.label, "Request to be travel buddies");
    assert.equal(v.primary?.action, "request");
    assert.equal(v.secondary, null);
  });
  test("asked: Accept plus Decline, and the sentence names them", () => {
    const v = buddyPinView(entry("pending_received"), "Pratik");
    assert.equal(v.text, "Pratik asked to be your travel buddy for this trip.");
    assert.equal(v.primary?.label, "Accept");
    assert.equal(v.secondary?.label, "Decline");
  });
  test("waiting: no buttons", () => {
    const v = buddyPinView(entry("pending_sent"), "Pratik");
    assert.equal(v.text, "Waiting for Pratik to accept.");
    assert.equal(v.primary, null);
    assert.equal(v.secondary, null);
  });
  test("buddies / completed: the plain outcome, no buttons", () => {
    for (const s of ["buddies", "completed"] as const) {
      const v = buddyPinView(entry(s), "Pratik");
      assert.equal(v.text, "You're travel buddies for this trip.");
      assert.equal(v.primary, null);
    }
  });
  test("no state ever says delivery, deal or listing", () => {
    for (const s of ALL) {
      const v = buddyPinView(entry(s), "Pratik");
      const words = [v.text, v.primary?.label ?? "", v.secondary?.label ?? ""].join(" ").toLowerCase();
      assert.ok(!/delivery|deal|listing/.test(words), `${s}: ${words}`);
    }
    for (const a of ["request", "accept", "decline"] as const) {
      assert.ok(!/delivery|deal|listing/i.test(buddyActionToast(a, "Pratik")));
    }
  });
});

describe("which entry the chat shows", () => {
  const base = { wantedId: null, serverSelectedDealId: null, openedFromBuddyCard: false };
  test("no buddy entry: never", () => {
    assert.equal(isBuddyEntrySelected({ ...base, buddy: null, openedFromBuddyCard: true }), false);
  });
  test("the user's tap wins either way", () => {
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("buddies"), wantedId: BUDDY_ENTRY_ID, serverSelectedDealId: "cr-1" }), true);
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("pending_received"), wantedId: "cr-1", openedFromBuddyCard: true }), false);
  });
  test("opened from a buddy card: the buddy entry, even beside a live deal", () => {
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("none"), serverSelectedDealId: "cr-1", openedFromBuddyCard: true }), true);
  });
  test("a live parcel deal keeps its pin by default, unless I owe an answer", () => {
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("pending_sent"), serverSelectedDealId: "cr-1" }), false);
    // A request waiting for MY answer is shown first, even beside a live parcel deal.
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("pending_received"), serverSelectedDealId: "cr-1" }), true);
  });
  test("no parcel deal on screen: an open request shows; a finished trip does not take over", () => {
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("pending_received") }), true);
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("pending_sent") }), true);
    assert.equal(isBuddyEntrySelected({ ...base, buddy: entry("buddies") }), false);
  });
});

describe("switcher", () => {
  test("only with two or more things to choose between", () => {
    assert.equal(switcherEntryCount(0, entry("none")), 1, "buddy only: no switcher");
    assert.equal(switcherEntryCount(1, null), 1, "one deal: no switcher");
    assert.equal(switcherEntryCount(1, entry("none")), 2);
  });
});
