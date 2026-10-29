import assert from "node:assert/strict";
import { test } from "node:test";

import {
  CITY_MESSAGE,
  EMPTY_RETURN_FORM,
  returnFormChanges,
  validateReturnAddress,
  validateReturnForm,
} from "./addressOptions.ts";

const ok = { line1: "123 Market Street", city: "San Francisco", state: "CA", postal: "94105", country: "US" };

// 27 Oct 2026: same city rule as web - letters, spaces, hyphens, apostrophes (and periods).
test("real city names pass", () => {
  for (const city of ["San Francisco", "Winston-Salem", "Coeur d'Alene", "St. Louis", "Bengaluru", "São Paulo"]) {
    assert.equal(validateReturnAddress({ ...ok, city }).city, undefined, city);
  }
});

test("digits and symbols are refused with web's message", () => {
  for (const city of ["12345", "Test1", "San Francisco!", "-Dash", "@home"]) {
    assert.equal(validateReturnAddress({ ...ok, city }).city, CITY_MESSAGE, city);
  }
  assert.equal(CITY_MESSAGE, "City can only contain letters, spaces, hyphens and apostrophes.");
});

test("too short still asks for the city", () => {
  assert.equal(validateReturnAddress({ ...ok, city: "a" }).city, "Enter the city.");
});

test("the address is only checked for a returnable online order", () => {
  assert.deepEqual(validateReturnForm({ ...EMPTY_RETURN_FORM, isOnlineOrder: true }), {});
  const errs = validateReturnForm({ ...EMPTY_RETURN_FORM, isOnlineOrder: true, returnEligible: true });
  assert.ok(errs.line1 && errs.city && errs.country);
});

test("edit sends only what changed, and just the flags when unticked", () => {
  const stored = {
    is_online_order: true, return_eligible: true, return_address_line1: "123 Market Street",
    return_city: "San Francisco", return_state: "CA", return_postal_code: "94105",
    return_country: "US", return_reference: null,
  };
  const same = { isOnlineOrder: true, returnEligible: true, line1: "123 Market Street", city: "San Francisco", state: "CA", postal: "94105", country: "US", reference: "" };
  assert.deepEqual(returnFormChanges(same, stored), {});
  assert.deepEqual(returnFormChanges({ ...same, city: "Oakland" }, stored), { return_city: "Oakland" });
  assert.deepEqual(returnFormChanges({ ...same, returnEligible: false }, stored), { return_eligible: false });
  assert.deepEqual(returnFormChanges({ ...EMPTY_RETURN_FORM }, stored), { is_online_order: false, return_eligible: false });
});
