import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { receiptDate, receiptFooter, receiptTotals, txStatusWords, txTypeWords, type ReceiptLine } from "./receiptModel.ts";
import { formatMoney } from "../../utils/money.ts";
import { COMPANY_JURISDICTION, COMPANY_NAME, PLATFORM_NAME, SUPPORT_EMAIL } from "../../constants/company.ts";

// Twin of web src/features/payments/lib/__tests__/receiptModel.test.ts - the two
// receipts must agree word for word (29 Oct 2026 receipts audit).
const text = (lines: ReceiptLine[]) => lines.map((l) => `${l.label}: ${l.value}${l.strong ? " *" : ""}`);

test("a payment: carrier fee + platform fee (10%) = total paid", () => {
  assert.deepEqual(
    text(receiptTotals({ type: "payment", status: "held", amount: 110, platform_fee: 10, net_amount: 100, currency: "USD" }, formatMoney)),
    ["Carrier fee: $100.00", "Platform fee (10%): $10.00", "Total paid: $110.00 *"],
  );
});

test("rupees use Indian grouping", () => {
  assert.deepEqual(
    text(receiptTotals({ type: "payment", status: "completed", amount: 132000, platform_fee: 12000, net_amount: 120000, currency: "INR" }, formatMoney)),
    ["Carrier fee: ₹1,20,000.00", "Platform fee (10%): ₹12,000.00", "Total paid: ₹1,32,000.00 *"],
  );
});

test("a legacy payment with no fee on record shows only what was paid", () => {
  assert.deepEqual(text(receiptTotals({ type: "payment", status: "completed", amount: 45, currency: "USD" }, formatMoney)), ["Total paid: $45.00 *"]);
});

test("a refund is one line, never 'Platform fee —'", () => {
  assert.deepEqual(text(receiptTotals({ type: "refund", status: "completed", amount: 27.5, currency: "USD" }, formatMoney)), ["Amount refunded: $27.50 *"]);
});

test("earnings net of a cancellation penalty say so", () => {
  assert.deepEqual(
    text(receiptTotals({
      type: "payout", status: "completed", amount: 95, agreed_amount: 100, currency: "USD",
      description: "Delivery payout — auto-released on OTP confirmation ($5.00 cancellation penalty deducted)",
    }, formatMoney)),
    ["Carrier fee: $100.00", "Cancellation penalty deducted: −$5.00", "Your earnings: $95.00 *"],
  );
  assert.deepEqual(
    text(receiptTotals({ type: "payout", status: "pending", amount: 100, agreed_amount: 100, currency: "INR" }, formatMoney)),
    ["Your earnings: ₹100.00 *"],
  );
});

test("a penalty is owed (−), a waiver credited (+)", () => {
  assert.deepEqual(text(receiptTotals({ type: "penalty", status: "pending", amount: 0.99, currency: "USD" }, formatMoney)), ["Cancellation penalty: −$0.99 *"]);
  assert.deepEqual(text(receiptTotals({ type: "penalty", status: "pending", amount: -0.99, currency: "USD" }, formatMoney)), ["Penalty waived: +$0.99 *"]);
});

test("words, never raw codes; a readable date, never ISO", () => {
  assert.equal(txStatusWords("held"), "Held until delivery");
  assert.equal(txTypeWords("wallet_topup"), "Top-up");
  const d = receiptDate("2026-10-29T15:04:00Z");
  assert.match(d, /2026/);
  assert.doesNotMatch(d, /T15|2026-10-29/);
  assert.equal(receiptDate("nope"), "");
});

test("the footer names the support inbox and the legal entity (same as web)", () => {
  assert.deepEqual(
    receiptFooter({ platform: PLATFORM_NAME, companyName: COMPANY_NAME, jurisdiction: COMPANY_JURISDICTION, supportEmail: SUPPORT_EMAIL }),
    [
      "This is a system-generated receipt from Safarly. For questions, contact admin@mysafarly.com.",
      "Safarly is operated by Vedanth LLC, a Washington State Limited Liability Company.",
    ],
  );
});

test("the receipt PDF renders the shared model (totals, date, footer, booking row)", () => {
  const src = readFileSync("src/features/wallet/receiptPdf.ts", "utf8");
  assert.ok(src.includes("const totals = receiptTotals(tx, money);"));
  assert.ok(src.includes("receiptDate(tx.created_at)"));
  assert.ok(src.includes('RECEIPT_FOOTER.map((l) => esc(l)).join("<br />")'));
  assert.ok(!src.includes('value: tx.booking_id ? `#${tx.booking_id.slice(0, 8)}` : "—"'));
  assert.ok(!src.includes("Net amount"));
  assert.doesNotMatch(readFileSync("src/features/wallet/receiptModel.ts", "utf8"), /^import /m);
});
