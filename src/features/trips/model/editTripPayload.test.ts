import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { tripEditInitial, tripEditPayload } from "./editTripPayload.ts";

/**
 * Edit trip (28 Oct 2026 edit canon): only changed fields are sent, the date
 * is single (no "Return"), and there is no Notes field - List trip has none.
 */

const trip = {
  from_city: "Hyderabad",
  from_country: "IN",
  to_city: "Dallas",
  to_country: "US",
  any_from: false,
  any_to: false,
  travel_date: "2026-11-10",
  travel_date_from: "2026-11-10",
  travel_date_to: "2026-11-10",
  luggage_capacity_kg: 10,
  open_to_buddy: false,
};

test("nothing changed sends nothing", () => {
  assert.deepEqual(tripEditPayload(tripEditInitial(trip), trip), {});
});

test("a new date is sent as one day: from = to", () => {
  const v = { ...tripEditInitial(trip), travel_date_from: "2026-11-20" };
  assert.deepEqual(tripEditPayload(v, trip), {
    travel_date: "2026-11-20",
    travel_date_from: "2026-11-20",
    travel_date_to: "2026-11-20",
  });
});

test("an older range trip opened and saved untouched keeps its end date", () => {
  const ranged = { ...trip, travel_date_to: "2026-11-15" };
  const v = { ...tripEditInitial(ranged), luggage_capacity_kg: "12" };
  assert.deepEqual(tripEditPayload(v, ranged), { luggage_capacity_kg: 12 });
});

test("the form has no notes or return date, so neither is ever sent", () => {
  const init = tripEditInitial({ ...trip, travel_date_to: "2026-11-15" }) as unknown as Record<string, unknown>;
  assert.equal("notes" in init, false);
  assert.equal("travel_date_to" in init, false);
  const body = tripEditPayload({ ...tripEditInitial(trip), from_city: "Mumbai" }, trip) as Record<string, unknown>;
  assert.equal("notes" in body, false);
});

test("route: Any city and a country switch are sent with their flags", () => {
  const v = { ...tripEditInitial(trip), from_city: "ANY", to_country: "IN" as const, to_city: "Chennai" };
  assert.deepEqual(tripEditPayload(v, trip), {
    from_city: "Any",
    from_country: "IN",
    any_from: true,
    to_city: "Chennai",
    to_country: "IN",
    any_to: false,
  });
  const anyTrip = { ...trip, any_from: true, from_city: "Any" };
  assert.equal(tripEditInitial(anyTrip).from_city, "ANY");
  assert.deepEqual(tripEditPayload(tripEditInitial(anyTrip), anyTrip), {});
});

test("the buddy toggle is sent only when it changed", () => {
  assert.deepEqual(tripEditPayload({ ...tripEditInitial(trip), open_to_buddy: true }, trip), { open_to_buddy: true });
});

test("the module's ANY sentinel is CityPicker's ANY_CITY", () => {
  assert.match(readFileSync("src/features/search/CityPicker.tsx", "utf8"), /export const ANY_CITY = "ANY";/);
});

// ---- guards on the modal and its callers (source checks; RN can't load in node)

const MODAL = readFileSync("src/features/trips/EditTripModal.tsx", "utf8");
const ACTIONS = readFileSync("src/features/travels/hooks/useMyTravelsActions.ts", "utf8");
const MODALS = readFileSync("src/features/travels/components/MyTravelsEditModals.tsx", "utf8");
const DETAILS = readFileSync("src/features/trips/TripDetailsScreen.tsx", "utf8");

test("B4: the server's refusal shows inside the modal, under the scroll, above the footer", () => {
  const scrollEnd = MODAL.indexOf("</ScrollView>");
  const errorAt = MODAL.indexOf("{serverError ? (");
  const footerAt = MODAL.indexOf("<View style={styles.footer}>");
  assert.ok(scrollEnd > 0 && errorAt > scrollEnd && footerAt > errorAt);
  assert.match(MODALS, /serverError=\{editTripError\}/);
  assert.match(DETAILS, /serverError=\{editError\}/);
  // No prefixed banner behind the modal any more.
  assert.doesNotMatch(ACTIONS, /Couldn't update trip\./);
  assert.doesNotMatch(ACTIONS, /Couldn't update listing\./);
  assert.doesNotMatch(ACTIONS, /Couldn't update parcel\./);
});

test("B9: the travel document block is inside the scroll area", () => {
  assert.ok(MODAL.indexOf("<ListingFilesField") < MODAL.indexOf("</ScrollView>"));
});

test("wording: single Travel date, no Return / Notes, canon errors", () => {
  assert.match(MODAL, /fieldLabel}>Travel date</);
  assert.doesNotMatch(MODAL, /Return <Text/);
  assert.doesNotMatch(MODAL, /Notes <Text/);
  assert.match(MODAL, /"Pick your travel date"/);
  assert.match(MODAL, /Exceeds the airline limit of \$\{MAX_WEIGHT_KG\} kg per item\./);
  assert.doesNotMatch(MODAL, /kg or less/);
  assert.match(MODAL, /"Pick a date"/);
});

test("Trip details: success is the same toast as My Travels, not a banner", () => {
  assert.match(DETAILS, /showToast\(/);
  assert.match(DETAILS, /title: "Trip updated", variant: "success"/);
  assert.doesNotMatch(DETAILS, /Your changes are saved\./);
  assert.doesNotMatch(DETAILS, /Departure city required/);
});
