import assert from "node:assert/strict";
import { describe, test } from "node:test";

import { currencySymbol, formatMoney, formatMoneyShort } from "./money.ts";

// Mirrors web's `src/test/feeCurrency.test.ts` — money.ts is a port of web's
// formatter, so this suite exists to prove both platforms print a fee the same
// way. A fee that reads one thing on the phone and another in the browser is
// the confusion this module exists to remove.
//
// The reported bug: a parcel from Coimbatore to Newark, fee entered as ₹3600,
// shown as "$3600". ₹3600 is about $43, so the screen overstated the offer
// roughly eightyfold — to a carrier deciding whether to fly it.
//
// Mobile was worse than web in two ways. PayBookingScreen, the screen where a
// sender commits to paying, printed "$" on the carrier fee, the platform fee
// and the total, while payment-handler charges in the LISTING's currency. And
// two screens rendered an INR amount with no currency mark at all
// (`currency === "USD" ? "$" : ""`), so ₹3600 read as a bare "3600".

describe("currencySymbol", () => {
  test("knows the two currencies the platform transacts in", () => {
    assert.equal(currencySymbol("USD"), "$");
    assert.equal(currencySymbol("INR"), "₹");
  });

  test("does not care about case", () => {
    assert.equal(currencySymbol("inr"), "₹");
    assert.equal(currencySymbol("usd"), "$");
  });

  test("falls back to dollars when nothing is given", () => {
    assert.equal(currencySymbol(null), "$");
    assert.equal(currencySymbol(undefined), "$");
    assert.equal(currencySymbol(""), "$");
  });

  test("shows an unknown currency as its code rather than guessing a symbol", () => {
    assert.equal(currencySymbol("EUR"), "EUR ");
    assert.equal(currencySymbol("AED"), "AED ");
  });

  test("NEVER returns an empty string — a bare number is the ambiguity this fixes", () => {
    for (const code of ["USD", "INR", "EUR", "GBP", "xyz", "", null, undefined]) {
      assert.notEqual(currencySymbol(code as string), "", `empty symbol for ${String(code)}`);
    }
  });
});

describe("formatMoney", () => {
  test("renders rupees as rupees", () => {
    assert.equal(formatMoney(3600, "INR"), "₹3600.00");
  });

  test("renders dollars as dollars", () => {
    assert.equal(formatMoney(43.5, "USD"), "$43.50");
  });

  test("always shows two decimals, for amounts people pay", () => {
    assert.equal(formatMoney(5, "USD"), "$5.00");
    assert.equal(formatMoney("12.3", "INR"), "₹12.30");
  });

  test("treats a missing amount as zero rather than NaN", () => {
    assert.equal(formatMoney(null, "INR"), "₹0.00");
    assert.equal(formatMoney(undefined, "USD"), "$0.00");
  });

  test("a missing currency behaves as every hardcoded call site already did", () => {
    assert.equal(formatMoney(10), "$10.00");
  });
});

describe("formatMoneyShort", () => {
  test("leaves a whole fee whole, so a listing does not read like a price tag", () => {
    assert.equal(formatMoneyShort(3600, "INR"), "₹3600");
    assert.equal(formatMoneyShort(25, "USD"), "$25");
  });

  test("keeps decimals when there are any", () => {
    assert.equal(formatMoneyShort(43.5, "USD"), "$43.50");
  });

  test("carries the currency just the same", () => {
    assert.notEqual(formatMoneyShort(3600, "INR"), formatMoneyShort(3600, "USD"));
  });
});

describe("the bug itself", () => {
  test("₹3600 never renders as $3600", () => {
    const rendered = formatMoneyShort(3600, "INR");
    assert.equal(rendered, "₹3600");
    assert.ok(!rendered.includes("$"), "a rupee fee must never carry a dollar sign");
  });

  test("the same number in two currencies is never displayed identically", () => {
    assert.notEqual(formatMoney(3600, "INR"), formatMoney(3600, "USD"));
  });
});
