import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { carrierTripMatchesParcel, parcelMatchesTrip } from "../../../utils/routeMatch.ts";
import { matchFocusTarget } from "./matchFocus.ts";

/**
 * 28 Oct 2026, User Four on staging: an Any(IN) -> Any(US) trip posted 5 s before
 * User Four's own Any -> Any parcel. Its notification therefore says
 * `for=<Ranchi -> Billings parcel>`, the only one that fitted at the time. Web pages
 * to the FIRST parcel holding the match; mobile followed `for` and showed the trip
 * under Ranchi -> Billings. Rows are the real staging rows, trimmed.
 */
const anyParcel = {
  id: "28709932", from_city: "Any", to_city: "Any", from_country: "IN", to_country: "US",
  any_from: true, any_to: true, delivery_by: "2026-11-06", delivery_by_from: "2026-11-06",
  delivery_by_to: "2026-11-06", delivery_date_mode: "single",
};
const ranchiParcel = {
  id: "54b6894d", from_city: "Ranchi", to_city: "Billings", from_country: "IN", to_country: "US",
  any_from: false, any_to: false, delivery_by: "2026-11-13", delivery_by_from: "2026-11-13",
  delivery_by_to: "2026-11-13", delivery_date_mode: "single",
};
const mumbaiParcel = {
  id: "d9cba304", from_city: "Mumbai, MH", to_city: "Newark (EWR), NJ", from_country: "IN", to_country: "US",
  any_from: false, any_to: false, delivery_by: "2026-10-29", delivery_by_from: "2026-10-29",
  delivery_by_to: "2026-10-29", delivery_date_mode: "single",
};
const userSixTrip = {
  id: "87d0c37e", from_city: "Any", to_city: "Any", from_country: "IN", to_country: "US",
  any_from: true, any_to: true, travel_date: "2026-11-06", travel_date_from: "2026-11-06",
  travel_date_to: "2026-11-06",
};
// Sorted the way both clients sort your parcels (delivery_by ascending).
const myParcels = [mumbaiParcel, anyParcel, ranchiParcel];

test("Any -> Any trip lands on the Any -> Any parcel posted after it, not the `for` parcel", () => {
  const groups = myParcels.map((p) => ({
    id: p.id,
    matchIds: carrierTripMatchesParcel(userSixTrip, p) ? [userSixTrip.id] : [],
  }));
  assert.deepEqual(groups.map((g) => g.matchIds.length), [0, 1, 1]); // same as web
  assert.equal(
    matchFocusTarget({ activeTab: "package", highlightId: "87d0c37e", forId: "54b6894d", groups, flatIds: [] }),
    "28709932",
  );
  // A summary (no match id) still scrolls to the listing it names.
  assert.equal(
    matchFocusTarget({ activeTab: "package", highlightId: undefined, forId: "54b6894d", groups, flatIds: [] }),
    "54b6894d",
  );
});

test("an Any trip is bounded by country only when the whole row is passed (web passes it)", () => {
  const usToIn = { ...userSixTrip, id: "x", from_country: "US", to_country: "IN" };
  assert.equal(carrierTripMatchesParcel(usToIn, anyParcel), false);
  // The old mobile call copied cities + any_* + travel_date only: no countries, so
  // "Any" matched a trip going the other way.
  const stripped = { from_city: usToIn.from_city, to_city: usToIn.to_city, any_from: true, any_to: true, travel_date: usToIn.travel_date };
  assert.equal(carrierTripMatchesParcel(stripped, anyParcel), true);
  // Receiver side, same rule.
  const usToInParcel = { ...anyParcel, from_country: "US", to_country: "IN" };
  assert.equal(parcelMatchesTrip(usToInParcel, userSixTrip), false);
});

test("guard: Search groups matches from the whole row, never a hand-copied subset", () => {
  const src = readFileSync(new URL("../hooks/useSearchResultLists.ts", import.meta.url), "utf8");
  assert.match(src, /carrierTripMatchesParcel\(m, parcel\)/);
  assert.match(src, /parcelMatchesTrip\(\{ \.\.\.m, delivery_by: m\.delivery_by \}, trip\)/);
  assert.doesNotMatch(src, /travel_date: m\.travel_date,/);
});
