import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { feeAutofill } from "./feeAutofill.ts";

const read = (rel: string) => readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8");

test("edit: clearing the fee to type a new one never snaps the suggestion back (client, 2 Nov 2026)", () => {
  // The user deletes the amount: the field is empty and touched.
  assert.equal(feeAutofill("edit", true, 45, ""), null);
  // ...and types a new amount: nothing overwrites it, whatever the weight says.
  assert.equal(feeAutofill("edit", true, 45, "3"), null);
  assert.equal(feeAutofill("edit", true, 60, "30"), null);
});

test("edit: an existing amount is never rewritten, and an empty untouched one is filled", () => {
  assert.equal(feeAutofill("edit", false, 45, "40"), null);
  assert.equal(feeAutofill("edit", false, 45, ""), "45");
  assert.equal(feeAutofill("edit", false, null, ""), null);
});

test("create: the suggestion follows the weight until the user types, clearing included", () => {
  assert.equal(feeAutofill("create", false, 45, ""), "45");
  assert.equal(feeAutofill("create", false, 55, "45"), "55");
  assert.equal(feeAutofill("create", true, 55, ""), null);
  assert.equal(feeAutofill("create", true, 55, "30"), null);
});

test("both screens mark the fee touched on every keystroke and use the shared rule", () => {
  const edit = read("src/features/parcels/EditParcelModal.tsx");
  assert.match(edit, /onChangeText=\{\(t\) => \{\s*setFeeTouched\(true\);\s*setForm\(\(prev\) => \(\{ \.\.\.prev, fee_offered:/);
  assert.match(edit, /feeAutofill\("edit", feeTouched, suggestedFee, form\.fee_offered\)/);
  assert.match(edit, /setReturnTouched\(false\);\s*setFeeTouched\(false\);/);
  const create = read("src/features/parcels/SendParcelScreen.tsx");
  assert.match(create, /setFeeTouched\(true\);\s*setFeeOffered\(sanitizeDecimalInput\(v, 6, 2\)\);/);
  assert.match(create, /feeAutofill\("create", feeTouched, suggestedFee, ""\)/);
});
