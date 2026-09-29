import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { bookingFee, feeBreakdown } from "./paymentMath.ts";

// Mirrors web's `src/test/bookingCharge.test.ts`.
//
// The bug these guard: the "Pay now · $X" button and the booking cards quoted
// `parcel.fee_offered` - the sender's still-editable ASKING price - while checkout
// and the server charge `agreed_amount`. Fixtures are the real mismatching bookings
// found in production.

const serverCharges = (agreed: number) => {
  const pf = Math.round(agreed * 0.1 * 100) / 100;
  return Math.round((agreed + pf) * 100) / 100;
};

describe("bookingFee - the agreed price wins", () => {
  test("the reported Bangalore -> Los Angeles booking", () => {
    const b = { agreed_amount: "100", parcel: { fee_offered: "65.00" } };
    assert.equal(bookingFee(b), 100);
    assert.equal(feeBreakdown(bookingFee(b)).total, 110);
    assert.notEqual(feeBreakdown(bookingFee(b)).total, 71.5);
  });

  test("every real mismatching booking in production", () => {
    const cases: Array<[number, number, number, number]> = [
      [100, 65, 71.5, 110],
      [90, 80, 88, 99],
      [125, 100, 110, 137.5],
      [2, 5, 5.5, 2.2],
    ];
    for (const [agreed, listed, wrong, right] of cases) {
      const b = { agreed_amount: String(agreed), parcel: { fee_offered: listed.toFixed(2) } };
      assert.equal(feeBreakdown(bookingFee(b)).total, right);
      assert.notEqual(feeBreakdown(bookingFee(b)).total, wrong);
      assert.equal(feeBreakdown(bookingFee(b)).total, serverCharges(agreed));
    }
  });

  test("falls back to the listing only for legacy bookings with no agreed amount", () => {
    assert.equal(bookingFee({ agreed_amount: null, parcel: { fee_offered: "65.00" } }), 65);
    assert.equal(bookingFee({ parcel: { fee_offered: 65 } }), 65);
  });

  test("an agreed amount of zero still beats the listing", () => {
    assert.equal(bookingFee({ agreed_amount: 0, parcel: { fee_offered: 65 } }), 0);
  });

  test("never renders NaN on missing or junk data", () => {
    assert.equal(bookingFee(null), 0);
    assert.equal(bookingFee(undefined), 0);
    assert.equal(bookingFee({}), 0);
    assert.equal(bookingFee({ agreed_amount: "not a number" }), 0);
  });
});
