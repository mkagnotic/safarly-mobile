import assert from "node:assert/strict";
import { test } from "node:test";

import { STAGE_ORDER, computeJourney, type StageKey } from "./journeyTracker.ts";
import type { Booking, Parcel } from "@/services/api";

// Ported from web's `src/customer/components/__tests__/journeyTracker.test.ts`.
// journeyTracker.ts is a verbatim copy of web's logic, so this suite exists to
// prove the two platforms actually agree — if a case here diverges from web,
// the port has drifted.

const NOW = new Date(2026, 6, 17); // 2026-07-17, local

function parcel(status: string): Parcel {
  return { id: "p1", sender_id: "u1", status } as Parcel;
}

function booking(overrides: Partial<Booking>): Booking {
  return {
    id: "b1",
    parcel_id: "p1",
    sender_id: "u1",
    carrier_id: "c1",
    status: "pending_payment",
    created_at: "2026-07-10T10:00:00Z",
    agreed_travel_date: null,
    handoff_accepted_at: null,
    delivered_at: null,
    // Default to a verified deal (grandfathered / travel-doc approved).
    carrier_request: { travel_doc_status: "approved" },
    ...overrides,
  } as Booking;
}

/** Map of stage key → state, for concise assertions. */
function states(p: Parcel | null, b: Booking | null) {
  const r = computeJourney(p, b, NOW);
  const map = {} as Record<StageKey, string>;
  for (const s of r.stages) map[s.key] = s.state;
  return { ...r, map };
}

test("returns all 11 stages in canonical order", () => {
  const r = computeJourney(parcel("open"), null, NOW);
  assert.deepEqual(r.stages.map((s) => s.key), STAGE_ORDER);
  assert.equal(r.stages.length, 11);
});

test("open parcel with no booking: nothing done, Matched is current", () => {
  const { map, reachedIndex } = states(parcel("open"), null);
  assert.equal(reachedIndex, -1);
  assert.equal(map.matched, "current");
  assert.equal(map.flight_verified, "upcoming");
});

test("matched parcel (no booking row yet): Matched done via parcel status", () => {
  const { map } = states(parcel("matched"), null);
  assert.equal(map.matched, "done");
});

test("pending_payment booking: matched/approved done, payment is the frontier", () => {
  const { map } = states(parcel("matched"), booking({ status: "pending_payment" }));
  assert.equal(map.matched, "done");
  assert.equal(map.parcel_approved, "done");
  assert.notEqual(map.payment_secured, "done");
  assert.equal(map.traveling, "upcoming");
});

// Handoff-first: the carrier physically receives the parcel BEFORE any money
// moves, so Parcel Received is a milestone of its own rather than part of the
// set-up cluster. A pending_payment booking with no handoff stamp is a legacy
// escrow-first deal, which genuinely has not been received yet.
test("set-up cluster resolves at match; Parcel Received is the frontier", () => {
  const { map } = states(parcel("matched"), booking({ status: "pending_payment" }));
  for (const k of ["matched", "flight_verified", "parcel_approved"] as StageKey[]) {
    assert.equal(map[k], "done");
  }
  assert.equal(map.parcel_received, "current");
  assert.equal(map.payment_secured, "upcoming");
});

test("handoff-first: the carrier has it, payment is the frontier", () => {
  const { map } = states(
    parcel("matched"),
    booking({ status: "pending_payment", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
  );
  assert.equal(map.parcel_received, "done");
  assert.equal(map.payment_secured, "current");
});

test("flight_verified gates on travel-doc approval while unpaid", () => {
  const unverified = states(
    parcel("matched"),
    booking({ status: "pending_payment", carrier_request: { travel_doc_status: "pending" } }),
  );
  assert.equal(unverified.map.matched, "done");
  assert.equal(unverified.map.flight_verified, "current");
  assert.equal(unverified.map.parcel_approved, "upcoming");
  assert.equal(unverified.map.payment_secured, "upcoming");
});

test("flight_verified surfaces the pinned travel date as its detail", () => {
  const withoutDate = computeJourney(parcel("matched"), booking({ status: "pending_payment" }), NOW);
  assert.equal(withoutDate.stages.find((s) => s.key === "flight_verified")?.detail, undefined);
  const withDate = computeJourney(
    parcel("matched"),
    booking({ status: "pending_payment", agreed_travel_date: "2026-08-01" }),
    NOW,
  );
  assert.ok(withDate.stages.find((s) => s.key === "flight_verified")?.detail?.includes("Flight"));
});

// Under handoff-first, awaiting_handoff means the deal is agreed but the
// carrier does NOT have the parcel yet - and nothing has been paid.
test("awaiting_handoff (unpaid, not yet received): Parcel Received is the frontier", () => {
  const { map } = states(parcel("matched"), booking({ status: "awaiting_handoff" }));
  assert.equal(map.parcel_approved, "done");
  assert.equal(map.parcel_received, "current");
  assert.equal(map.payment_secured, "upcoming");
});

test("payment_secured: parcel received AND paid, waiting on the flight", () => {
  const { map } = states(
    parcel("matched"),
    booking({ status: "payment_secured", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
  );
  assert.equal(map.parcel_received, "done");
  assert.equal(map.payment_secured, "done");
  assert.notEqual(map.traveling, "done");
});

// Stage 10 used to be inferred from "travel date has passed", which lit up on a
// date with no evidence the carrier had actually landed.
test("Ready for Delivery needs the carrier's landing, not a date", () => {
  const flying = states(
    parcel("in_transit"),
    booking({ status: "in_transit", journey_started_at: "2026-07-16T09:00:00Z", agreed_travel_date: "2026-07-16" }),
  );
  assert.notEqual(flying.map.ready_for_delivery, "done");
  const landed = states(
    parcel("in_transit"),
    booking({
      status: "in_transit",
      journey_started_at: "2026-07-16T09:00:00Z",
      ready_for_delivery_at: "2026-07-16T20:00:00Z",
    }),
  );
  assert.equal(landed.map.ready_for_delivery, "done");
});

test("in_transit: traveling done, delivery steps upcoming (monotonic fill)", () => {
  const { map } = states(
    parcel("in_transit"),
    booking({
      status: "in_transit",
      handoff_accepted_at: "2026-07-15T09:00:00Z",
      journey_started_at: "2026-07-16T09:00:00Z",
    }),
  );
  for (const k of [
    "matched",
    "flight_verified",
    "parcel_approved",
    "parcel_received",
    "payment_secured",
    "traveling",
  ] as StageKey[]) {
    assert.equal(map[k], "done");
  }
  assert.notEqual(map.otp_verification, "done");
});

test("Travel Tomorrow reaches when the agreed date is within a day", () => {
  const soon = states(
    parcel("matched"),
    booking({ status: "awaiting_handoff", agreed_travel_date: "2026-07-18" }), // tomorrow
  );
  assert.equal(soon.map.travel_tomorrow, "done");
  const later = states(
    parcel("matched"),
    booking({ status: "awaiting_handoff", agreed_travel_date: "2026-07-25" }),
  );
  assert.notEqual(later.map.travel_tomorrow, "done");
});

test("delivered but not yet rated: Review is the final current step", () => {
  const { map } = states(
    parcel("in_transit"),
    booking({ status: "delivered", delivered_at: "2026-07-16T12:00:00Z" }),
  );
  assert.equal(map.otp_verification, "done");
  assert.equal(map.payment_released, "done");
  assert.equal(map.review, "current");
});

test("delivered AND rated: Review completes, journey is fully done", () => {
  const r = states(
    parcel("in_transit"),
    booking({
      status: "delivered",
      delivered_at: "2026-07-16T12:00:00Z",
      viewer_has_rated: true,
    }),
  );
  assert.equal(r.map.review, "done");
  // Every one of the 11 stages is done — nothing left as current/upcoming.
  assert.equal(r.stages.filter((s) => s.state === "done").length, STAGE_ORDER.length);
  assert.equal(r.reachedIndex, STAGE_ORDER.length - 1);
});

test("viewer_has_rated is per-viewer: false leaves Review open", () => {
  const { map } = states(
    parcel("in_transit"),
    booking({
      status: "delivered",
      delivered_at: "2026-07-16T12:00:00Z",
      viewer_has_rated: false,
    }),
  );
  assert.equal(map.review, "current");
});

test("cancelled booking is flagged failed with a label", () => {
  const r = computeJourney(parcel("open"), booking({ status: "cancelled" }), NOW);
  assert.equal(r.failed, true);
  assert.ok(r.failedLabel);
});

test("progress never regresses: reachedIndex is monotonic across the flow", () => {
  const flow = [
    booking({ status: "awaiting_handoff" }),
    booking({ status: "pending_payment", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
    booking({ status: "payment_secured", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
    booking({
      status: "in_transit",
      handoff_accepted_at: "2026-07-15T09:00:00Z",
      journey_started_at: "2026-07-16T09:00:00Z",
    }),
    booking({ status: "delivered", delivered_at: "2026-07-16T12:00:00Z" }),
  ];
  const idxs = flow.map((b) => computeJourney(parcel("matched"), b, NOW).reachedIndex);
  for (let i = 1; i < idxs.length; i += 1) {
    assert.ok(idxs[i] > idxs[i - 1], `stage ${i} should advance past ${i - 1}`);
  }
});

// Legacy escrow-first deal that lapsed before anything moved. The cross is
// pinned to Payment Secured because that is what the label is about - the
// generic "next milestone" rule would put it on Parcel Received under a
// "Payment expired" caption, which reads as a contradiction.
test("expired_unpaid: fails at Payment Secured, rest skipped", () => {
  const { map, ...r } = states(parcel("open"), booking({ status: "expired_unpaid" }));
  assert.equal(r.outcome, "cancelled");
  assert.equal(r.outcomeLabel, "Payment expired");
  assert.equal(map.parcel_approved, "done");
  assert.equal(map.payment_secured, "failed");
  assert.equal(map.traveling, "skipped");
  assert.equal(map.review, "skipped");
});

// The new unhappy path: the carrier DID receive it, the sender never paid, so
// the parcel has to go home.
test("unpaid_return: parcel received, fails at Payment Secured", () => {
  const { map, ...r } = states(
    parcel("matched"),
    booking({ status: "unpaid_return", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
  );
  assert.equal(r.outcome, "cancelled");
  assert.equal(map.parcel_received, "done");
  assert.equal(map.payment_secured, "failed");
});

test("handoff_rejected: the parcel reached the carrier, then was refused", () => {
  const { map, ...r } = states(
    parcel("open"),
    booking({ status: "handoff_rejected", handoff_dispatched_at: "2026-07-14T09:00:00Z" }),
  );
  assert.equal(r.outcome, "cancelled");
  assert.equal(map.parcel_received, "done");
  assert.equal(map.payment_secured, "failed");
  assert.equal(r.outcomeLabel, "Declined at handoff");
});

test("cancelled_post_possession: traveled, fails after Traveling (mid-trip)", () => {
  const { map, ...r } = states(
    parcel("in_transit"),
    booking({ status: "cancelled_post_possession", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
  );
  assert.equal(map.traveling, "done");
  assert.equal(map.otp_verification, "failed");
  assert.equal(r.outcomeLabel, "Cancelled mid-trip");
});

test("cancelled pre-payment (nothing moved): fails at Parcel Received", () => {
  const { map, ...r } = states(
    parcel("open"),
    booking({ status: "cancelled", cancellation_phase: "pre_payment" }),
  );
  assert.equal(r.outcome, "cancelled");
  assert.equal(map.parcel_approved, "done");
  assert.equal(map.parcel_received, "failed");
});

test("disputed: green up to progress, amber frontier, outcome disputed", () => {
  const r = computeJourney(
    parcel("disputed"),
    booking({
      status: "disputed",
      handoff_accepted_at: "2026-07-15T09:00:00Z",
      journey_started_at: "2026-07-16T09:00:00Z",
    }),
    NOW,
  );
  assert.equal(r.outcome, "disputed");
  assert.ok(r.stages.find((s) => s.state === "disputed"));
  assert.equal(r.stages.find((s) => s.key === "traveling")?.state, "done");
  assert.equal(r.failed, false);
});

// Legacy escrow-first rows sat in 'confirmed'/'awaiting_handoff' AFTER paying.
// They are told apart by a handoff stamp, not by status.
test("legacy escrow-first row with possession reads as received", () => {
  const { map, ...r } = states(
    parcel("matched"),
    booking({ status: "confirmed", handoff_accepted_at: "2026-07-15T09:00:00Z" }),
  );
  assert.equal(r.outcome, "active");
  assert.equal(map.parcel_received, "done");
});
