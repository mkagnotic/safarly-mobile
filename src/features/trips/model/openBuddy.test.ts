import assert from "node:assert/strict";
import { test } from "node:test";

import { BUDDY_AGE_ERROR, buddyAgeError, editTripBuddyMessage, listTripBuddySentence } from "./openBuddy.ts";

test("age: empty is allowed, 18-120 whole numbers pass, anything else errors", () => {
  assert.equal(buddyAgeError(""), null);
  assert.equal(buddyAgeError("18"), null);
  assert.equal(buddyAgeError("120"), null);
  for (const bad of ["1", "17", "121", "999", "2.5", "abc"]) assert.equal(buddyAgeError(bad), BUDDY_AGE_ERROR, bad);
});

test("list trip success sentence follows buddy_listing", () => {
  assert.match(listTripBuddySentence("created"), /We also created your buddy listing/);
  assert.match(listTripBuddySentence("existing"), /You already had a buddy listing/);
  assert.match(listTripBuddySentence("failed"), /We couldn't create your buddy listing/);
  assert.equal(listTripBuddySentence(null), "");
  assert.equal(listTripBuddySentence(undefined), "");
});

test("edit trip message: off wins, otherwise by buddy_listing", () => {
  assert.equal(editTripBuddyMessage(false, null)?.text, "Your buddy listing for this trip was removed.");
  assert.equal(editTripBuddyMessage(true, "created")?.text, "Your buddy listing is live in Travel Partners.");
  assert.equal(editTripBuddyMessage(true, "existing")?.text, "You already have a buddy listing for this route.");
  assert.equal(editTripBuddyMessage(true, "failed")?.variant, "warning");
  assert.equal(editTripBuddyMessage(undefined, undefined), null);
});
