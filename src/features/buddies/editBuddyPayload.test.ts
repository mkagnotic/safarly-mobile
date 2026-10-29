import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { INDIA_CITIES, USA_CITIES } from "../search/cityLists.ts";
import { buddyCountryOf, buddyEditInitial, buddyEditPayload } from "./editBuddyPayload.ts";

/**
 * Edit buddy listing (28 Oct 2026 edit canon, B7): the toggle starts on the
 * stored country (an "Any" city has no other), and the PUT sends it.
 */

const lists = { india: INDIA_CITIES, usa: USA_CITIES };

const listing = {
  from_city: "Any",
  to_city: "Any",
  from_country: "US",
  to_country: "IN",
  travel_date: "2026-12-01",
  travel_date_from: "2026-12-01",
  airline: null,
  age: 30,
  languages: ["English"],
  interests: null,
  layover: null,
  bio: "Hi",
};

test("Any -> Any keeps the countries the user picked", () => {
  const init = buddyEditInitial(listing, lists);
  assert.equal(init.from_city, "ANY");
  assert.equal(init.from_country, "US");
  assert.equal(init.to_city, "ANY");
  assert.equal(init.to_country, "IN");
  const body = buddyEditPayload(init);
  assert.equal(body.from_city, "Any");
  assert.equal(body.from_country, "US");
  assert.equal(body.to_city, "Any");
  assert.equal(body.to_country, "IN");
});

test("no stored country: the city's own list, else the old default", () => {
  const usCity = USA_CITIES[0];
  const inCity = INDIA_CITIES[0];
  assert.equal(buddyCountryOf(null, usCity, lists, "IN"), "US");
  assert.equal(buddyCountryOf(undefined, inCity, lists, "US"), "IN");
  assert.equal(buddyCountryOf(null, "Any", lists, "IN"), "IN");
  assert.equal(buddyCountryOf("", "Any", lists, "US"), "US");
  // Stored wins over the list, case-insensitively.
  assert.equal(buddyCountryOf("in", usCity, lists, "US"), "IN");
});

test("the PUT stays a full body (the handler nulls what is left out)", () => {
  const body = buddyEditPayload(buddyEditInitial(listing, lists));
  assert.deepEqual(Object.keys(body).sort(), [
    "age", "airline", "bio", "from_city", "from_country", "interests", "languages", "layover",
    "to_city", "to_country", "travel_date", "travel_date_from", "travel_date_to",
  ]);
  assert.equal(body.travel_date_from, body.travel_date_to);
  assert.equal(body.age, 30);
});

// ---- guards (source checks; RN can't load in node)

const MODAL = readFileSync("src/features/buddies/EditBuddyListingModal.tsx", "utf8");
const DETAILS = readFileSync("src/features/buddies/PartnerDetailsScreen.tsx", "utf8");
const MODALS = readFileSync("src/features/travels/components/MyTravelsEditModals.tsx", "utf8");

test("B4: the server's refusal shows inside the modal on both screens", () => {
  const scrollEnd = MODAL.indexOf("</ScrollView>");
  const errorAt = MODAL.indexOf("{serverError ? (");
  assert.ok(errorAt > scrollEnd && MODAL.indexOf("<View style={styles.footer}>") > errorAt);
  assert.match(MODALS, /serverError=\{editBuddyError\}/);
  assert.match(DETAILS, /serverError=\{editError\}/);
});

test("both screens seed from the shared helper (no USA_CITIES/INDIA_CITIES guess per end)", () => {
  for (const src of [DETAILS, MODALS]) {
    assert.match(src, /buddyEditInitial\(/);
    assert.doesNotMatch(src, /USA_CITIES\.includes\(/);
  }
});

test("Partner details: 'Buddy listing updated' toast, not the 'Listing updated' banner", () => {
  assert.match(DETAILS, /showToast\(\{ title: "Buddy listing updated", variant: "success" \}\)/);
  assert.doesNotMatch(DETAILS, /"Listing updated"/);
});

test("wording: (optional) lower case, date prompt + 12-month hint, age hint", () => {
  assert.doesNotMatch(MODAL, /\(Optional\)/);
  assert.match(MODAL, /"Pick your travel date"/);
  assert.match(MODAL, /Select a travel date up to 12 months from today\./);
  assert.match(MODAL, /Between 18 and 120\./);
  assert.match(readFileSync("src/features/buddies/buddyOptions.ts", "utf8"), /`Age must be between \$\{MIN_AGE\} and \$\{MAX_AGE\}\.`/);
});
