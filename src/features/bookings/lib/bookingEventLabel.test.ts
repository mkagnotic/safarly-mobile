import { test } from "node:test";
import assert from "node:assert/strict";
import { bookingEventLabel, bookingStatusLabel } from "./bookingEventLabel.ts";

// 27 Oct 2026: the booking timeline and status pills showed raw codes ("otp generated").
test("timeline events in plain words", () => {
  assert.equal(bookingEventLabel("handoff_accepted"), "Carrier accepted the parcel");
  assert.equal(bookingEventLabel("payment_held"), "Payment received");
  assert.equal(bookingEventLabel("otp_generated"), "Delivery code created");
});
test("never an underscore, even for an unknown code", () => {
  assert.equal(bookingEventLabel("some_new_event"), "Some new event");
  assert.equal(bookingStatusLabel("brand_new_status"), "Brand new status");
  assert.equal(bookingEventLabel(null), "");
});
test("handover, not handoff", () => {
  assert.equal(bookingStatusLabel("awaiting_handoff"), "Handover pending");
  assert.equal(bookingStatusLabel("handoff_rejected"), "Declined at handover");
});
