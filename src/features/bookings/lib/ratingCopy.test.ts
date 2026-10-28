/**
 * Rating + currency canon (28 Oct 2026): one wording and rule set for rating a
 * delivery on web, Android and iOS. Pure rules tested directly; screen wiring
 * by source.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  RATING_COPY,
  REVIEW_MAX,
  SCORE_LABELS,
  canRateBooking,
  counterpartRoleLabel,
  formatRating,
  isAlreadyRatedError,
} from "./ratingCopy.ts";
import { formatMoneyShort } from "../../../utils/money.ts";

const src = (p: string) => readFileSync(p, "utf8");

test("one label set + wording (same as web)", () => {
  assert.deepEqual([1, 2, 3, 4, 5].map((n) => SCORE_LABELS[n]), ["Poor", "Fair", "Good", "Very good", "Excellent"]);
  assert.equal(RATING_COPY.title, "Rate delivery");
  assert.equal(RATING_COPY.question("Asha"), "How was your experience with Asha?");
  assert.equal(RATING_COPY.tapHint, "Tap a star to rate");
  assert.equal(RATING_COPY.submit, "Submit rating");
  assert.equal(RATING_COPY.submitting, "Submitting…");
  assert.equal(RATING_COPY.successTitle, "Rating submitted");
  assert.equal(RATING_COPY.successBody, "Thanks for your feedback!");
  assert.equal(RATING_COPY.errorTitle, "Couldn't submit rating");
  assert.equal(REVIEW_MAX, 500);
  assert.equal(counterpartRoleLabel(true), "Carrier");
  assert.equal(counterpartRoleLabel(false), "Receiver");
  for (const f of ["src/components/reviews/RateDeliverySheet.tsx", "src/features/bookings/DeliveryReviewScreen.tsx"]) {
    const s = src(f);
    assert.doesNotMatch(s, /"Very Good"|"Tap to rate"|Submit review|Couldn't submit review|Rate your delivery/);
  }
});

test("bug 6 (HIGH): the Rate delivery tab resets when the booking changes", () => {
  const s = src("src/features/bookings/DeliveryReviewScreen.tsx");
  assert.match(s, /useEffect\(\(\) => \{\s*setScore\(0\);\s*setReview\(""\);\s*setSubmitted\(false\);\s*setAlreadyRated\(false\);\s*\}, \[bookingId\]\);/);
});

test("bug 8: no stars / Rate button for a booking that was never delivered", () => {
  assert.equal(canRateBooking("delivered"), true);
  for (const st of ["cancelled", "in_transit", "awaiting_handoff", "pending_payment", undefined, null]) {
    assert.equal(canRateBooking(st), false);
  }
  const page = src("src/features/bookings/DeliveryReviewScreen.tsx");
  assert.match(page, /if \(!canRateBooking\(booking\?\.status\)\) \{/);
  assert.match(page, /RATING_COPY\.notDelivered/);
  const details = src("src/features/travels/DeliveryDetailsScreen.tsx");
  assert.match(details, /\) : canRateBooking\(booking\.status\) \? \(/);
});

test("bug 9: 500-character review cap with a counter", () => {
  const page = src("src/features/bookings/DeliveryReviewScreen.tsx");
  assert.match(page, /maxLength=\{REVIEW_MAX\}/);
  assert.match(page, /\{review\.length\}\/\{REVIEW_MAX\}/);
});

test("bug 10: CONFLICT counts as already rated (prompt closes, no error toast)", () => {
  assert.equal(isAlreadyRatedError({ code: "CONFLICT", message: "Already rated this booking" }), true);
  assert.equal(isAlreadyRatedError({ code: "VALIDATION_ERROR" }), false);
  assert.equal(isAlreadyRatedError(new Error("x")), false);
  assert.equal(isAlreadyRatedError(null), false);
  const prompt = src("src/components/reviews/RateDeliveryPrompt.tsx");
  const conflictAt = prompt.indexOf("if (isAlreadyRatedError(err)) {");
  assert.ok(conflictAt > 0 && conflictAt < prompt.indexOf("RATING_COPY.errorTitle"));
  assert.match(src("src/features/bookings/DeliveryReviewScreen.tsx"), /if \(isAlreadyRatedError\(err\)\) \{\s*setAlreadyRated\(true\);/);
});

test("bug 11: rating shows as ★ 4.8 only when > 0 (one shared formatter)", () => {
  assert.equal(formatRating(4.666666), "★ 4.7");
  assert.equal(formatRating(0), null);
  assert.equal(formatRating(null), null);
  assert.equal(formatRating(undefined), null);
  const opp = src("src/features/opportunities/OpportunitiesScreen.tsx");
  assert.match(opp, /formatRating\(sender\.rating\)/);
  assert.doesNotMatch(opp, /sender\.rating\.toFixed\(1\)/);
});

test("currency: suggested fee grouped (₹10,250), dead $ helper gone", () => {
  assert.equal(formatMoneyShort(10250, "INR"), "₹10,250");
  assert.equal(formatMoneyShort(1250, "USD"), "$1,250");
  const create = src("src/features/parcels/SendParcelScreen.tsx");
  assert.match(create, /\$\{formatMoneyShort\(suggestedFee, currency\)\}\. You can offer more or less\./);
  assert.match(create, /Enter the parcel weight above and we'll suggest a fair fee\./);
  assert.equal(existsSync("src/features/parcels/model/createParcel.ts"), false);
});
