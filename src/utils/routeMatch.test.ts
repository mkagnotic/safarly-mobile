import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  carrierTripMatchesParcel,
  endsMeet,
  matchesLocation,
  parcelMatchesTrip,
  routesOverlap,
  sameCountry,
} from "./routeMatch.ts";

// Mirrors web's `src/test/routeMatch.test.ts` - routeMatch.ts is a copy of web's
// logic, so this suite exists to prove the two platforms agree.
//
// The bug these guard: the rule was `anyFromA || anyFromB || cityMatch(...)`.
// Either side ticking "Any City" satisfied that axis unconditionally, so a listing
// flexible on BOTH ends matched every listing in the database and surfaced in every
// other user's filtered search. "Any" now means any city inside the country the
// owner already selected (from_country / to_country are NOT NULL).

const IN = "IN", US = "US", GB = "GB";

describe("sameCountry", () => {
  test("case-insensitive, and unknown never matches on its own", () => {
    assert.equal(sameCountry("in", "IN"), true);
    assert.equal(sameCountry(" US ", "us"), true);
    assert.equal(sameCountry(IN, US), false);
    assert.equal(sameCountry(null, IN), false);
  });
});

describe("endsMeet", () => {
  test("concrete vs concrete is a plain city comparison (unchanged)", () => {
    assert.equal(endsMeet({ city: "Chennai", country: IN }, { city: "Chennai", country: IN }), true);
    assert.equal(endsMeet({ city: "Chennai", country: IN }, { city: "Delhi", country: IN }), false);
  });

  test("a flexible end accepts any city in its OWN country", () => {
    const flexIN = { city: "Any", country: IN, any: true };
    assert.equal(endsMeet(flexIN, { city: "Chennai", country: IN }), true);
    assert.equal(endsMeet(flexIN, { city: "Delhi", country: IN }), true);
  });

  test("a flexible end rejects a city in another country - the fix", () => {
    const flexIN = { city: "Any", country: IN, any: true };
    assert.equal(endsMeet(flexIN, { city: "Dallas", country: US }), false);
    assert.equal(endsMeet(flexIN, { city: "London", country: GB }), false);
  });

  test("two flexible ends meet only within the same country", () => {
    assert.equal(endsMeet({ country: IN, any: true }, { country: IN, any: true }), true);
    assert.equal(endsMeet({ country: IN, any: true }, { country: US, any: true }), false);
  });

  test("an unknown country stays permissive rather than hiding a listing", () => {
    assert.equal(endsMeet({ any: true }, { city: "Dallas", country: US }), true);
  });
});

describe("routesOverlap - an Any -> Any listing", () => {
  const overlap = (pFrom: string, pTo: string, pFromC: string, pToC: string) =>
    routesOverlap("Any", "Any", true, true, pFrom, pTo, false, false, {
      fromCountryA: IN, toCountryA: US, fromCountryB: pFromC, toCountryB: pToC,
    });

  test("still matches a real India -> USA route", () => {
    assert.equal(overlap("Chennai", "Dallas", IN, US), true);
    assert.equal(overlap("Delhi", "New York", IN, US), true);
  });

  test("no longer matches an unrelated route - the reported problem", () => {
    assert.equal(overlap("London", "Paris", GB, "FR"), false);
    assert.equal(overlap("Dallas", "Chennai", US, IN), false); // wrong direction
    assert.equal(overlap("Chennai", "Delhi", IN, IN), false);  // domestic
  });

  test("one flexible end only relaxes that end", () => {
    const r = (pFrom: string, pTo: string, pFromC: string, pToC: string) =>
      routesOverlap("Any", "Dallas", true, false, pFrom, pTo, false, false, {
        fromCountryA: IN, toCountryA: US, fromCountryB: pFromC, toCountryB: pToC,
      });
    assert.equal(r("Chennai", "Dallas", IN, US), true);
    assert.equal(r("Chennai", "New York", IN, US), false);
    assert.equal(r("London", "Dallas", GB, US), false);
  });

  test("concrete listings are completely unaffected", () => {
    assert.equal(routesOverlap("Chennai", "Dallas", false, false, "Chennai", "Dallas", false, false,
      { fromCountryA: IN, toCountryA: US, fromCountryB: IN, toCountryB: US }), true);
    assert.equal(routesOverlap("Chennai", "Dallas", false, false, "Delhi", "Dallas", false, false,
      { fromCountryA: IN, toCountryA: US, fromCountryB: IN, toCountryB: US }), false);
  });
});

describe("matchesLocation - a listing's Any must not bypass a search filter", () => {
  test("no filter means no constraint", () => {
    assert.equal(matchesLocation(undefined, "Chennai"), true);
    assert.equal(matchesLocation("ANY", "Chennai"), true);
  });

  test("a flexible listing answers a city filter only when countries agree", () => {
    assert.equal(matchesLocation("Chennai", "Any", true, IN, IN), true);
    assert.equal(matchesLocation("Chennai", "Any", true, IN, US), false);
  });

  test("without a filter country the permissive answer stands", () => {
    assert.equal(matchesLocation("Chennai", "Any", true), true);
  });

  test("a concrete listing is matched on city as before", () => {
    assert.equal(matchesLocation("Chennai", "Chennai, TN", false, IN, IN), true);
    assert.equal(matchesLocation("Chennai", "Delhi", false, IN, IN), false);
  });
});

describe("parcel <-> trip pairing keeps route AND dates", () => {
  const trip = (over: Record<string, unknown> = {}) => ({
    from_city: "Chennai", to_city: "Dallas", from_country: IN, to_country: US,
    travel_date: "2026-09-10", travel_date_from: "2026-09-10", travel_date_to: "2026-09-10",
    ...over,
  }) as never;
  // Every parcel in the database carries both bounds; the window ends at the deadline.
  const parcel = (over: Record<string, unknown> = {}) => ({
    from_city: "Chennai", to_city: "Dallas", from_country: IN, to_country: US,
    delivery_by: "2026-09-20", delivery_by_from: "2026-09-05", delivery_by_to: "2026-09-20",
    ...over,
  }) as never;

  test("matches an exact route inside the delivery window", () => {
    assert.equal(carrierTripMatchesParcel(trip(), parcel()), true);
    assert.equal(parcelMatchesTrip(parcel(), trip()), true);
  });

  test("a trip BEFORE the sender's earliest date no longer matches", () => {
    // The old rule was `travel_date <= delivery_by` with no lower bound, so mobile
    // matched trips departing weeks before the sender could hand the parcel over -
    // matches web and the server would never make.
    assert.equal(carrierTripMatchesParcel(trip({ travel_date: "2026-08-01", travel_date_from: "2026-08-01", travel_date_to: "2026-08-01" }), parcel()), false);
  });

  test("a trip after the deadline still does not match", () => {
    assert.equal(carrierTripMatchesParcel(trip({ travel_date: "2026-10-01", travel_date_from: "2026-10-01", travel_date_to: "2026-10-01" }), parcel()), false);
  });

  test("a flexible trip pairs within its country pair", () => {
    assert.equal(carrierTripMatchesParcel(trip({ from_city: "Any", any_from: true }), parcel({ from_city: "Delhi" })), true);
  });

  test("a flexible trip does NOT pair across countries", () => {
    assert.equal(
      carrierTripMatchesParcel(
        trip({ from_city: "Any", any_from: true }),
        parcel({ from_city: "London", from_country: GB }),
      ),
      false,
    );
  });

  test("dates still bind", () => {
    assert.equal(
      carrierTripMatchesParcel(
        trip({ travel_date: "2026-09-25", travel_date_from: "2026-09-25", travel_date_to: "2026-09-25" }),
        parcel(),
      ),
      false,
    );
  });
});
