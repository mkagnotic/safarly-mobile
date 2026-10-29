import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { returnFormChanges, returnFormFromParcel, validateReturnForm } from "../../../utils/addressOptions.ts";
import { parcelEditInitial, parcelEditPayload } from "./editParcelPayload.ts";

/**
 * Edit parcel (28 Oct 2026 edit canon, B5/B6): My Travels' list row carries no
 * currency_locked and no private return address, so Edit loads the owner's
 * detail; until then the return block is neither checked nor sent.
 */

const listRow = {
  from_city: "Austin",
  from_country: "US",
  to_city: "Pune",
  to_country: "IN",
  any_from: false,
  any_to: false,
  weight_kg: 2,
  description: "",
  category: "personal",
  fee_offered: 40,
  fee_currency: "USD",
  delivery_by: "2026-11-30",
  delivery_by_from: "2026-11-30",
  delivery_by_to: "2026-11-30",
  delivery_date_mode: "single" as const,
  // A returnable online order: the flags come on the list row ...
  is_online_order: true,
  return_eligible: true,
  return_city: "Austin",
  return_state: "Texas",
  return_country: "US",
};

// ... the street, postal code and order number only on the owner's detail.
const detail = {
  ...listRow,
  return_address_line1: "500 Congress Ave",
  return_postal_code: "78701",
  return_reference: "ORD-1",
  return_state: "TX",
  currency_locked: true,
};

test("B6: from the list row alone the address is incomplete, so it must not be checked", () => {
  const fromList = returnFormFromParcel(listRow);
  assert.ok(Object.keys(validateReturnForm(fromList)).length > 0);
  const fromDetail = returnFormFromParcel(detail);
  assert.deepEqual(validateReturnForm(fromDetail), {});
});

test("B6: a save before the detail loads sends no return fields", () => {
  const v = { ...parcelEditInitial(listRow, returnFormFromParcel(listRow)), weight_kg: "3" };
  assert.deepEqual(parcelEditPayload(v, listRow, {}), { weight_kg: 3 });
});

test("B6: prefilled from the detail, an untouched return block sends nothing", () => {
  const v = { ...parcelEditInitial(detail, returnFormFromParcel(detail)), fee_offered: "45" };
  assert.deepEqual(parcelEditPayload(v, detail, returnFormChanges(v.returnForm, detail)), { fee_offered: 45 });
});

test("an older row holding a state's name maps to its code (web's stateCodeOf)", () => {
  assert.equal(returnFormFromParcel({ ...detail, return_state: "Texas" }).state, "TX");
  assert.equal(returnFormFromParcel({ ...detail, return_state: "texas" }).state, "TX");
  assert.equal(returnFormFromParcel({ ...detail, return_state: "TX" }).state, "TX");
  assert.equal(returnFormFromParcel({ ...detail, return_state: "Nowhere" }).state, "Nowhere");
  assert.equal(returnFormFromParcel({ ...detail, return_state: null }).state, "");
});

test("nothing changed sends nothing; dates travel as a set", () => {
  const init = parcelEditInitial(listRow, returnFormFromParcel(listRow));
  assert.deepEqual(parcelEditPayload(init, listRow, {}), {});
  const ranged = { ...init, delivery_date_mode: "range" as const, delivery_by_to: "2026-12-05" };
  assert.deepEqual(parcelEditPayload(ranged, listRow, {}), {
    delivery_date_mode: "range",
    delivery_by_from: "2026-11-30",
    delivery_by_to: "2026-12-05",
    delivery_by: "2026-12-05",
  });
});

test("currency change is sent", () => {
  const v = { ...parcelEditInitial(listRow, returnFormFromParcel(listRow)), fee_currency: "INR" as const };
  assert.deepEqual(parcelEditPayload(v, listRow, {}), { fee_currency: "INR" });
});

// ---- guards (source checks; RN can't load in node)

const MODAL = readFileSync("src/features/parcels/EditParcelModal.tsx", "utf8");
const MODALS = readFileSync("src/features/travels/components/MyTravelsEditModals.tsx", "utf8");
const ACTIONS = readFileSync("src/features/travels/hooks/useMyTravelsActions.ts", "utf8");
const DETAILS = readFileSync("src/features/parcels/ParcelDetailsScreen.tsx", "utf8");

test("B5: My Travels loads the detail and passes the currency lock", () => {
  assert.match(ACTIONS, /useParcelDetail\(editingParcel\?\.id\)/);
  assert.match(MODALS, /currencyLocked=\{!!editParcelDetail\?\.currency_locked\}/);
  assert.match(MODALS, /detailPending=\{!editParcelDetail\}/);
  assert.match(MODALS, /returnFormFromParcel\(editParcelDetail \?\? editingParcel\)/);
  // Until the detail loads the switch stays off.
  assert.match(MODAL, /const currencyDisabled = pending \|\| currencyLocked \|\| detailPending;/);
  assert.match(MODAL, /const checkReturn = !detailPending \|\| returnTouched;/);
  assert.match(ACTIONS, /options\.includeReturn \? returnFormChanges\(values\.returnForm, stored\) : \{\}/);
});

test("B9 + B4: files inside the scroll; the server's refusal above the footer", () => {
  const scrollEnd = MODAL.indexOf("</ScrollView>");
  assert.ok(MODAL.indexOf("<ListingFilesField") < scrollEnd);
  const errorAt = MODAL.indexOf("{serverError ? (");
  assert.ok(errorAt > scrollEnd && MODAL.indexOf("<View style={styles.footer}>") > errorAt);
});

test("inline errors, live same-route, fee on blur, canon wording", () => {
  assert.match(MODAL, /\{toCityError \? <Text style=\{styles\.inlineError\}>/);
  assert.match(MODAL, /onBlur=\{\(\) => \{\s*const problem = feeProblem\(\);/);
  assert.match(MODAL, /Used to suggest a fair carrier fee\. Airline max: \{MAX_WEIGHT_KG\} kg per item\./);
  // Same suggested-fee words as the create form, grouped (₹10,250) - kyc/rating/currency canon.
  assert.match(MODAL, /Suggested for \{form\.weight_kg\} kg: \{formatMoneyShort\(suggestedFee, form\.fee_currency\)\}\. You can offer more or less\./);
  assert.doesNotMatch(MODAL, /adjust to whatever you like/);
  assert.match(MODAL, /"Single date"/);
  assert.match(MODAL, /"Date range"/);
  assert.match(MODAL, /"Pick a delivery date"/);
  assert.match(MODAL, /"Pick the earliest delivery date"/);
  assert.doesNotMatch(MODAL, /Weight exceeds the airline limit/);
  assert.doesNotMatch(MODAL, /Pick a delivery deadline/);
  assert.doesNotMatch(MODAL, /\(Optional\)/);
});

test("Parcel details: success is a toast, not a banner", () => {
  assert.match(DETAILS, /showToast\(\{ title: "Parcel updated", variant: "success" \}\)/);
  assert.doesNotMatch(DETAILS, /Your changes are saved\./);
  assert.doesNotMatch(DETAILS, /Origin city required/);
});
