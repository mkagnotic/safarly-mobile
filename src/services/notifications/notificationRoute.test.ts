import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveNotificationRoute } from "./notificationRoute.ts";

// The bug these guard: a match notification opened Search on its DEFAULT tab
// ("Package Delivery Matches"), whatever the match was about. A carrier told
// "3 parcels match your trip" landed on the carriers list and had to find the
// Receiver Requests tab themselves.
//
// The `?match=<id>` id alone could not fix it — the page can only infer a tab from
// it once that row has loaded, and the "N match your trip" summaries carry no id at
// all. So the link now states the tab outright.

const SEARCH = "/customer/search";
const ID = "aaaaaaaa-1111-4000-8000-aaaaaaaaaaaa";

describe("match notifications open the right results tab", () => {
  test("a parcel match sends a carrier to Receiver Requests", () => {
    const r = resolveNotificationRoute(`${SEARCH}?match=${ID}&tab=receiver`, "booking");
    assert.equal(r.screen, "Trips");
    assert.deepEqual(r.params, { highlightId: ID, tab: "receiver" });
  });

  test("a trip match sends a sender to Package Delivery Matches", () => {
    const r = resolveNotificationRoute(`${SEARCH}?match=${ID}&tab=package`, "booking");
    assert.deepEqual(r.params, { highlightId: ID, tab: "package" });
  });

  test("a buddy match opens the buddy tab", () => {
    const r = resolveNotificationRoute(`${SEARCH}?match=${ID}&tab=buddy`, "buddy");
    assert.deepEqual(r.params, { highlightId: ID, tab: "buddy" });
  });

  test("the summary notifications carry a tab even with no match id", () => {
    // THE reported case: "3 parcels match your trip" has nothing to highlight.
    const r = resolveNotificationRoute(`${SEARCH}?tab=receiver`, "booking");
    assert.equal(r.screen, "Trips");
    assert.deepEqual(r.params, { tab: "receiver" });
  });

  test("tab order in the query string does not matter", () => {
    assert.deepEqual(
      resolveNotificationRoute(`${SEARCH}?tab=receiver&match=${ID}`, "booking").params,
      { highlightId: ID, tab: "receiver" },
    );
  });

  test("an unknown tab is ignored rather than trusted", () => {
    const r = resolveNotificationRoute(`${SEARCH}?tab=nonsense`, "booking");
    assert.equal(r.screen, "Trips");
    assert.equal(r.params, undefined);
  });

  test("a bare search link still works — no params, default tab", () => {
    const r = resolveNotificationRoute(SEARCH, "booking");
    assert.equal(r.screen, "Trips");
    assert.equal(r.params, undefined);
  });

  test("older links with only a match id keep working", () => {
    // Notifications sent before this change are still in people's feeds.
    assert.deepEqual(resolveNotificationRoute(`${SEARCH}?match=${ID}`, "booking").params, {
      highlightId: ID,
    });
  });
});

describe("every other notification route is untouched", () => {
  test("messages, bookings, travels, wallet and payouts still resolve", () => {
    // A link to a SPECIFIC conversation opens the chat itself, not the inbox.
    assert.equal(resolveNotificationRoute("/customer/messages/" + ID, "message").screen, "OfferChatTab");
    assert.equal(resolveNotificationRoute("/customer/messages", "message").screen, "MessagesTab");
    assert.deepEqual(resolveNotificationRoute("/customer/bookings/" + ID, "booking"), {
      screen: "BookingsTab",
      params: { expandId: ID },
    });
    assert.equal(resolveNotificationRoute("/customer/my-trips", "booking").screen, "Parcels");
    assert.equal(resolveNotificationRoute("/customer/wallet", "payment").screen, "TransactionsTab");
    assert.equal(resolveNotificationRoute("/customer/payout-setup", "payment").screen, "PayoutSetupTab");
  });
});
