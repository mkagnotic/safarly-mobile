import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveOffers, type OfferResolutionMessage } from "./offerResolution.ts";

const ME = "user-me";
const THEM = "user-them";

function offerCard(
  id: string,
  sender: string,
  payload: Record<string, unknown>,
): OfferResolutionMessage {
  return { id, sender_id: sender, message_kind: "offer_card", payload };
}

function accept(id: string, acceptedOfferId: string): OfferResolutionMessage {
  return { id, sender_id: ME, message_kind: "offer_accept", payload: { accepted_offer_id: acceptedOfferId } };
}

function reject(id: string, rejectedOfferId: string): OfferResolutionMessage {
  return { id, sender_id: ME, message_kind: "offer_reject", payload: { rejected_offer_id: rejectedOfferId } };
}

test("empty thread → no statuses, no live offer", () => {
  const r = resolveOffers([], ME);
  assert.equal(r.statusById.size, 0);
  assert.equal(r.live, null);
});

test("plain text messages are ignored", () => {
  const r = resolveOffers(
    [{ id: "m1", sender_id: THEM, message_kind: "text", payload: null }],
    ME,
  );
  assert.equal(r.statusById.size, 0);
  assert.equal(r.live, null);
});

test("single open offer from the other side is live and actionable (mine=false)", () => {
  const r = resolveOffers(
    [offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "open" })],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "open");
  assert.ok(r.live);
  assert.equal(r.live?.messageId, "m1");
  assert.equal(r.live?.offerId, "o1");
  assert.equal(r.live?.carrierRequestId, "cr1");
  assert.equal(r.live?.amount, 50);
  assert.equal(r.live?.mine, false);
});

test("my own open offer is live but flagged mine=true (waiting state)", () => {
  const r = resolveOffers(
    [offerCard("m1", ME, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "open" })],
    ME,
  );
  assert.equal(r.live?.mine, true);
});

test("from_user_id also identifies ownership", () => {
  const r = resolveOffers(
    [{ id: "m1", from_user_id: ME, message_kind: "offer_card", payload: { offer_id: "o1", amount: 10, currency: "USD", status: "open" } }],
    ME,
  );
  assert.equal(r.live?.mine, true);
});

test("a newer counter supersedes the older card for the same carrier_request", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "open" }),
      offerCard("m2", ME, { offer_id: "o2", carrier_request_id: "cr1", amount: 40, currency: "USD", status: "open" }),
    ],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "superseded");
  assert.equal(r.statusById.get("m2"), "open");
  // The live offer is the latest one (mine), so it shows the waiting state.
  assert.equal(r.live?.messageId, "m2");
  assert.equal(r.live?.mine, true);
});

test("an accept overrides the card status and clears the live offer", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "open" }),
      accept("m2", "o1"),
    ],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "accepted");
  assert.equal(r.live, null);
});

test("a reject overrides the card status and keeps no live offer", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "open" }),
      reject("m2", "o1"),
    ],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "rejected");
  assert.equal(r.live, null);
});

test("a server-marked expired latest card is not live", () => {
  const r = resolveOffers(
    [offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 50, currency: "USD", status: "expired" })],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "expired");
  assert.equal(r.live, null);
});

test("offer_card without an offer_id is ignored (defensive)", () => {
  const r = resolveOffers(
    [{ id: "m1", sender_id: THEM, message_kind: "offer_card", payload: { amount: 50, currency: "USD", status: "open" } }],
    ME,
  );
  assert.equal(r.statusById.size, 0);
  assert.equal(r.live, null);
});

test("offer_card with no carrier_request_id falls back to offer_id as the key", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", amount: 50, currency: "USD", status: "open" }),
      offerCard("m2", ME, { offer_id: "o1", amount: 40, currency: "USD", status: "open" }),
    ],
    ME,
  );
  // Same offer_id → same fallback key → m1 superseded, m2 live.
  assert.equal(r.statusById.get("m1"), "superseded");
  assert.equal(r.statusById.get("m2"), "open");
  assert.equal(r.live?.messageId, "m2");
});

test("two independent carrier_requests each resolve their own latest card", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "crA", amount: 50, currency: "USD", status: "open" }),
      offerCard("m2", THEM, { offer_id: "o2", carrier_request_id: "crB", amount: 70, currency: "USD", status: "open" }),
    ],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "open");
  assert.equal(r.statusById.get("m2"), "open");
  // `live` is the last open latest card encountered.
  assert.equal(r.live?.messageId, "m2");
});

test("full negotiation: seed → counter → counter-back → accept", () => {
  const r = resolveOffers(
    [
      offerCard("m1", THEM, { offer_id: "o1", carrier_request_id: "cr1", amount: 80, currency: "USD", status: "open" }),
      offerCard("m2", ME, { offer_id: "o2", carrier_request_id: "cr1", amount: 60, currency: "USD", status: "open" }),
      offerCard("m3", THEM, { offer_id: "o3", carrier_request_id: "cr1", amount: 70, currency: "USD", status: "open" }),
      accept("m4", "o3"),
    ],
    ME,
  );
  assert.equal(r.statusById.get("m1"), "superseded");
  assert.equal(r.statusById.get("m2"), "superseded");
  assert.equal(r.statusById.get("m3"), "accepted");
  assert.equal(r.live, null);
});
