import assert from "node:assert/strict";
import { test } from "node:test";

import { formatMoney } from "../../utils/money.ts";
import { dealCurrencyMap, offerDisplayCurrency, resolveOffers } from "./offerResolution.ts";

// AN14 (29 Oct 2026): offers made before 22 Oct 2026 were stored as USD on rupee
// deals too, so a ₹ deal's card read "$1,400.00". The deal's currency wins.
const deals = dealCurrencyMap([
  { carrier_request_id: "cr-inr", pricing: { currency: "INR" }, offer: { currency: "INR" } },
  { carrier_request_id: "cr-usd", pricing: { currency: "USD" }, offer: null },
]);

test("a legacy USD-labelled offer on a rupee deal shows in INR (same as web)", () => {
  const cur = offerDisplayCurrency({ carrier_request_id: "cr-inr", currency: "USD" }, deals);
  assert.equal(cur, "INR");
  assert.equal(formatMoney(1400, cur), "₹1,400.00");
  assert.equal(formatMoney(100000, "INR"), "₹1,00,000.00");
});

test("a correctly stored INR offer on a rupee deal is unchanged", () => {
  assert.equal(offerDisplayCurrency({ carrier_request_id: "cr-inr", currency: "INR" }, deals), "INR");
});

test("a USD deal still shows $", () => {
  const cur = offerDisplayCurrency({ carrier_request_id: "cr-usd", currency: "USD" }, deals);
  assert.equal(cur, "USD");
  assert.equal(formatMoney(1400, cur), "$1,400.00");
});

test("an unknown deal falls back to the offer's own currency", () => {
  assert.equal(offerDisplayCurrency({ carrier_request_id: "cr-other", currency: "INR" }, deals), "INR");
  assert.equal(offerDisplayCurrency({ currency: "INR" }, deals), "INR");
  assert.equal(offerDisplayCurrency({ carrier_request_id: "cr-other", currency: "" }, deals), "USD");
});

test("dealCurrencyMap reads pricing first, then the deal's offer; skips deals with neither", () => {
  const m = dealCurrencyMap([
    null,
    { carrier_request_id: "a", pricing: null, offer: { currency: "inr" } },
    { carrier_request_id: "b", pricing: null, offer: null },
  ]);
  assert.equal(m.get("a"), "INR");
  assert.equal(m.has("b"), false);
});

test("resolveOffers: the card and the live offer both take the deal's currency", () => {
  const msgs = [
    { id: "m1", sender_id: "them", message_kind: "offer_card", payload: { offer_id: "o1", carrier_request_id: "cr-inr", amount: 1400, currency: "USD", status: "open" } },
    { id: "m2", sender_id: "them", message_kind: "offer_card", payload: { offer_id: "o2", carrier_request_id: "cr-usd", amount: 20, currency: "USD", status: "open" } },
  ];
  const r = resolveOffers(msgs, "me", deals);
  assert.equal(r.currencyById.get("m1"), "INR");
  assert.equal(r.currencyById.get("m2"), "USD");
  // Without deal currencies the stored label stands (old callers unchanged).
  assert.equal(resolveOffers(msgs, "me").currencyById.get("m1"), "USD");
  const inrOnly = resolveOffers(msgs.slice(0, 1), "me", deals);
  assert.equal(inrOnly.live?.currency, "INR");
});
