import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { priceJustAgreed, resolveOffers } from "./offerResolution.ts";

// Client, 13 Nov 2026: after an offer was accepted, "Make an offer" came back in
// the chat for a few seconds - the step still read PRICE_OFFER until the refresh.
const open = { offer_id: "o1", status: "open" };

test("the accept gap: step still PRICE_OFFER, snapshot still holds the offer open -> hide", () => {
  assert.equal(priceJustAgreed({ workflowState: "PRICE_OFFER", serverOffer: open, acceptedOfferIds: ["o1"] }), true);
});

test("snapshot already says accepted but the step lags -> hide", () => {
  assert.equal(priceJustAgreed({ workflowState: "PRICE_OFFER", serverOffer: { offer_id: "o1", status: "accepted" }, acceptedOfferIds: [] }), true);
});

test("back to pricing later (old accepted offer in history, snapshot not open on it) -> show", () => {
  assert.equal(priceJustAgreed({ workflowState: "PRICE_OFFER", serverOffer: { offer_id: "o2", status: "open" }, acceptedOfferIds: ["o1"] }), false);
  assert.equal(priceJustAgreed({ workflowState: "PRICE_OFFER", serverOffer: null, acceptedOfferIds: ["o1"] }), false);
});

test("declined or nothing accepted -> the step shows as before; other steps untouched", () => {
  assert.equal(priceJustAgreed({ workflowState: "PRICE_OFFER", serverOffer: open, acceptedOfferIds: [] }), false);
  assert.equal(priceJustAgreed({ workflowState: "PAYMENT", serverOffer: { offer_id: "o1", status: "accepted" }, acceptedOfferIds: ["o1"] }), false);
});

test("the other side's accept counts as soon as its message lands", () => {
  const r = resolveOffers([
    { id: "m1", message_kind: "offer_card", payload: { offer_id: "o1", carrier_request_id: "cr", amount: 40, status: "open" }, from_user_id: "a" },
    { id: "m2", message_kind: "offer_accept", payload: { accepted_offer_id: "o1" }, from_user_id: "b" },
  ] as never, "a");
  assert.deepEqual(r.acceptedOfferIds, ["o1"]);
  assert.equal(r.live, null);
});

test("the chat screen hides the pin in that gap; an accept records it as accepted", () => {
  const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const screen = read("src/features/messages/OfferChatScreen.tsx");
  assert.ok(screen.includes("acceptedOfferIds: [...acceptedHereIds, ...offerState.acceptedOfferIds],"));
  assert.ok(read("src/features/messages/chat/hooks/useChatOfferActions.ts").includes('markOfferSettled(offerId, "accepted");'));
});
