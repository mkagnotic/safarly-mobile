import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { resolveNotificationRoute } from "../../services/notifications/notificationRoute.ts";
import { toUserMessage } from "../../lib/userFacingError.js";

/**
 * REGRESSION FENCES over the Travel Buddy defects reported from production on
 * 29 September 2026. Mirrors web's `src/test/travelBuddyFlow.test.ts`; both
 * platforms have to behave the same way, because the same person uses both.
 *
 * The reports:
 *   1. "I wasn't even able to create a request" — a toast reading, verbatim,
 *      "Could not query the database for the schema cache. Retrying."
 *   2. the listing card and its edit form disagreed about the travel date
 *   3. "Clicking this it's not taking to the chat or inbox. It goes to the search."
 *   4. "it should take to the right buddies module but it goes to packages"
 *
 * Mobile was already correct on (2) — its pickers parse with `parseYmd`, which
 * builds a LOCAL date, where web used `new Date("2026-09-30")` and landed on the
 * 29th west of Greenwich. The date fence below is here so mobile cannot drift
 * into the bug web just came out of.
 */

const ID = "11111111-2222-3333-4444-555555555555";

describe("a transient database failure never reaches a traveller as raw text", () => {
  const PGRST002 = "Could not query the database for the schema cache. Retrying.";

  test("the reported string is not shown verbatim", () => {
    assert.notEqual(toUserMessage(PGRST002), PGRST002);
    assert.ok(!/schema cache/i.test(toUserMessage(PGRST002)));
  });

  test("it reads as busy rather than broken — retrying really does work", () => {
    assert.match(toUserMessage(PGRST002), /busy|try again in a moment/i);
  });

  test("a schema-cache MISS does not promise that waiting helps", () => {
    const shown = toUserMessage(
      "Could not find the 'from_country' column of 'buddy_listings' in the schema cache",
    );
    assert.ok(!/buddy_listings|schema cache/.test(shown));
    assert.ok(!/in a moment/i.test(shown), "a missing column is not a wait-and-retry");
  });

  test("hand-written copy still passes through", () => {
    const real = "You already sent this person a buddy request.";
    assert.equal(toUserMessage(real), real);
  });
});

describe("a buddy notification lands where the user can act on it", () => {
  test("a buddy REQUEST opens Travel Partners, where it is accepted", () => {
    // ⚠️ Not the "Buddies" tab: that route name is legacy and renders the INBOX,
    // and web's `/customer/buddies` is its create-a-listing FORM. Neither end of
    // that link led to the request it was announcing.
    const r = resolveNotificationRoute("/customer/buddies", "buddy");
    assert.equal(r.screen, "Parcels");
    assert.deepEqual(r.params, { tab: "partners" });
  });

  test("the new backend link resolves to the same place", () => {
    const r = resolveNotificationRoute("/customer/my-trips?tab=partners", "buddy");
    assert.equal(r.screen, "Parcels");
    assert.deepEqual(r.params, { tab: "partners" });
  });

  test("a buddy notification with no link at all still lands on Travel Partners", () => {
    // OS push payloads may omit `link`; the type is then all we have.
    const r = resolveNotificationRoute(undefined, "buddy");
    assert.equal(r.screen, "Parcels");
    assert.deepEqual(r.params, { tab: "partners" });
  });

  test("an ACCEPTED request still opens the chat — that route was already right", () => {
    const r = resolveNotificationRoute(`/customer/messages/${ID}`, "buddy");
    assert.equal(r.screen, "OfferChatTab");
    assert.equal((r.params as { conversationId: string }).conversationId, ID);
  });

  test("a match notification still opens Search on the buddy tab", () => {
    const r = resolveNotificationRoute(`/customer/search?match=${ID}&tab=buddy`, "buddy");
    assert.equal(r.screen, "Trips");
    assert.deepEqual(r.params, { highlightId: ID, tab: "buddy" });
  });

  test("My Travels without a tab still opens its default — nothing broken in passing", () => {
    const r = resolveNotificationRoute("/customer/my-trips", "system");
    assert.equal(r.screen, "Parcels");
    assert.equal(r.params, undefined);
  });

  test("the other My Travels tabs are honoured too", () => {
    for (const tab of ["flights", "packages", "archive"]) {
      const r = resolveNotificationRoute(`/customer/my-trips?tab=${tab}`, "system");
      assert.equal(r.screen, "Parcels");
      assert.deepEqual(r.params, { tab }, `tab=${tab}`);
    }
  });

  test("an unknown tab is ignored rather than passed through", () => {
    const r = resolveNotificationRoute("/customer/my-trips?tab=nonsense", "system");
    assert.equal(r.params, undefined);
  });

  test("every other destination still routes — no collateral damage", () => {
    assert.equal(resolveNotificationRoute(`/customer/bookings/${ID}`, "booking").screen, "BookingsTab");
    assert.equal(resolveNotificationRoute("/customer/disputes", "dispute").screen, "DisputesTab");
    assert.equal(resolveNotificationRoute("/customer/profile/payout-setup", "payment").screen, "PayoutSetupTab");
    assert.equal(resolveNotificationRoute("/customer/activity", "rating").screen, "ActivityTab");
    assert.equal(resolveNotificationRoute(undefined, "message").screen, "MessagesTab");
    assert.equal(resolveNotificationRoute(undefined, undefined).screen, "Home");
  });
});

describe("a match notification shows the match it promised", () => {
  test("Search forces route-matching when opened from a notification", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/features/search/SearchScreen.tsx", "utf8");
    // Browse mode returns every open listing, server-paged, so the card the
    // notification promised is usually not on the first page.
    assert.match(src, /const isMatchDeepLink = !!\(highlightId \|\| requestedTab\)/);
    assert.match(src, /useState\(isMatchDeepLink\)/);
    assert.match(src, /isMatchDeepLink \? MATCH_MY_ROUTES_QUERY : BROWSE_QUERY/);
    // And the async restore must not drag the user back off it.
    assert.match(src, /isMatchDeepLink \? null : await loadPersistedSearch\(\)/);
  });
});

describe("mobile does not drift into web's date bug", () => {
  test("the buddy pickers parse a stored date as LOCAL, never as UTC", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of [
      "src/features/buddies/EditBuddyListingModal.tsx",
      "src/features/buddies/CreateBuddyScreen.tsx",
    ]) {
      const src = readFileSync(file, "utf8");
      // `new Date("2026-09-30")` is UTC midnight — the evening of the 29th west
      // of Greenwich. This is what made web's card and edit form disagree.
      assert.ok(
        !/new Date\(\s*\w*\.?travel_date/.test(src),
        `${file} parses a stored travel date as UTC`,
      );
    }
  });

  test("parseYmd keeps the calendar day", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/features/buddies/EditBuddyListingModal.tsx", "utf8");
    assert.match(src, /parseYmd/);
  });
});
