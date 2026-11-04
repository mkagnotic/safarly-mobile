import { test } from "node:test";
import assert from "node:assert/strict";

import {
  AUTO_UNMATCHED_TOAST,
  isLastTry,
  LAST_TRY_REJECT_WARNING,
  outOfTriesCta,
  rejectEndedMatch,
  parcelOutOfTries,
  PARCEL_NO_TRIES_LABEL,
  travelDocOutOfTries,
  TRAVEL_DOC_NO_TRIES_LABEL,
  triesLeft,
} from "./verificationTries.ts";

test("tries left never goes below zero and uses the fallback max", () => {
  assert.equal(triesLeft(2, 3, 3), 1);
  assert.equal(triesLeft(9, 3, 3), 0);
  assert.equal(triesLeft(undefined, undefined, 5), 5);
});

test("travel doc: out of tries only when rejected with 0 left", () => {
  assert.equal(travelDocOutOfTries({ status: "rejected", attempts: 3, max_attempts: 3 }), true);
  assert.equal(travelDocOutOfTries({ status: "rejected", attempts: 2, max_attempts: 3 }), false);
  assert.equal(travelDocOutOfTries({ status: "pending", attempts: 3, max_attempts: 3 }), false);
  assert.equal(travelDocOutOfTries(null), false);
});

test("parcel photos: out of tries when not under review and 0 left (default 5)", () => {
  assert.equal(parcelOutOfTries({ status: "rejected", attempts: 5 }), true);
  assert.equal(parcelOutOfTries({ status: "rejected", attempts: 4, max_attempts: 5 }), false);
  assert.equal(parcelOutOfTries({ status: "pending", attempts: 5 }), false);
  assert.equal(parcelOutOfTries({ status: "approved", attempts: 5 }), false);
});

test("the pin drops 'Upload' once tries are used up, whatever the server's label", () => {
  assert.deepEqual(
    outOfTriesCta("upload_parcel_photos", { parcelReview: { status: "rejected", attempts: 5, max_attempts: 5 } }),
    { label: PARCEL_NO_TRIES_LABEL, button: "Open" },
  );
  assert.deepEqual(
    outOfTriesCta("upload_travel_doc", { travelDoc: { status: "rejected", attempts: 3, max_attempts: 3 } }),
    { label: TRAVEL_DOC_NO_TRIES_LABEL, button: "Open" },
  );
  assert.equal(outOfTriesCta("upload_parcel_photos", { parcelReview: { status: "rejected", attempts: 1 } }), null);
  assert.equal(outOfTriesCta("upload_parcel_photos", {}), null);
  assert.equal(outOfTriesCta("review_parcel_photos", { parcelReview: { status: "rejected", attempts: 5 } }), null);
  assert.equal(PARCEL_NO_TRIES_LABEL, "No tries left for parcel photos");
  assert.equal(TRAVEL_DOC_NO_TRIES_LABEL, "No tries left for the travel document");
});

test("last try: a pending upload that used the final attempt", () => {
  // Travel document (3 tries).
  assert.equal(isLastTry({ status: "pending", attempts: 3, max_attempts: 3 }, 3), true);
  assert.equal(isLastTry({ status: "pending", attempts: 2, max_attempts: 3 }, 3), false);
  // Parcel photos (5 tries); older servers omit max_attempts -> fallback.
  assert.equal(isLastTry({ status: "pending", attempts: 5, max_attempts: 5 }, 5), true);
  assert.equal(isLastTry({ status: "pending", attempts: 5 }, 5), true);
  assert.equal(isLastTry({ status: "pending", attempts: 4 }, 5), false);
  assert.equal(isLastTry({ status: "pending" }, 5), false);
  // Only while the upload is waiting for review.
  assert.equal(isLastTry({ status: "rejected", attempts: 3, max_attempts: 3 }, 3), false);
  assert.equal(isLastTry({ status: "approved", attempts: 3, max_attempts: 3 }, 3), false);
  assert.equal(isLastTry(null, 3), false);
});

test("auto_unmatched: only a literal true from the reject endpoint ends the match", () => {
  assert.equal(rejectEndedMatch({ status: "rejected", auto_unmatched: true }), true);
  assert.equal(rejectEndedMatch({ status: "rejected", auto_unmatched: false }), false);
  // Older backends never send the field.
  assert.equal(rejectEndedMatch({ status: "rejected", attempts_left: 1 }), false);
  assert.equal(rejectEndedMatch({ auto_unmatched: "true" }), false);
  assert.equal(rejectEndedMatch(null), false);
  assert.equal(rejectEndedMatch(undefined), false);
});

test("auto-unmatch copy is the client-approved wording (web parity)", () => {
  assert.equal(LAST_TRY_REJECT_WARNING, "This was their last try. Rejecting it will end this match automatically.");
  assert.equal(AUTO_UNMATCHED_TOAST, "This match has ended automatically.");
});
