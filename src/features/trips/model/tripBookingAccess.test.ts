import assert from "node:assert/strict";
import { test } from "node:test";

import type { Booking } from "@/services/api";
import { viewerHasBookingOnTrip } from "./tripBookingAccess.ts";

const VIEWER = "viewer-1";
const CARRIER = "carrier-1";
const trip = {
  carrier_id: CARRIER,
  user_id: CARRIER,
  travel_date: "2026-11-02",
  travel_date_from: null,
  travel_date_to: null,
};

function booking(over: Partial<Booking>): Booking {
  return {
    id: "b1",
    parcel_id: "p1",
    carrier_request_id: "cr1",
    sender_id: VIEWER,
    carrier_id: CARRIER,
    status: "payment_secured",
    trip: { travel_date: "2026-11-02", travel_date_from: null, travel_date_to: null },
    ...over,
  } as Booking;
}

test("a live booking with the trip's carrier on the trip's dates exempts the viewer", () => {
  assert.equal(viewerHasBookingOnTrip([booking({})], trip, VIEWER), true);
});

test("a delivered booking still exempts — it is how both sides finish (rate, dispute)", () => {
  assert.equal(viewerHasBookingOnTrip([booking({ status: "delivered" })], trip, VIEWER), true);
});

test("a booking on a DIFFERENT trip of the same carrier does not", () => {
  const other = booking({ trip: { travel_date: "2026-12-20", travel_date_from: null, travel_date_to: null } });
  assert.equal(viewerHasBookingOnTrip([other], trip, VIEWER), false);
});

test("a booking that died before possession does not", () => {
  for (const status of ["cancelled", "expired_unpaid", "handoff_rejected"]) {
    assert.equal(viewerHasBookingOnTrip([booking({ status })], trip, VIEWER), false, status);
  }
});

test("someone else's booking, a different carrier, or no viewer does not", () => {
  assert.equal(viewerHasBookingOnTrip([booking({ sender_id: "other" })], trip, VIEWER), false);
  assert.equal(viewerHasBookingOnTrip([booking({ carrier_id: "carrier-2" })], trip, VIEWER), false);
  assert.equal(viewerHasBookingOnTrip([booking({})], trip, null), false);
  assert.equal(viewerHasBookingOnTrip([], trip, VIEWER), false);
});

test("a booking without trip dates falls back to the carrier match", () => {
  assert.equal(viewerHasBookingOnTrip([booking({ trip: null })], trip, VIEWER), true);
});
