import assert from "node:assert/strict";
import { test } from "node:test";

import { carrierPayout, feeBreakdown, formatCountdown, isUrgent } from "./paymentMath.ts";

const HOUR = 3600_000;
const DAY = 24 * HOUR;

test("fee breakdown: 10% platform fee + total (Part 3 §4)", () => {
  assert.deepEqual(feeBreakdown(50), { fee: 50, platformFee: 5, total: 55 });
  assert.deepEqual(feeBreakdown(5), { fee: 5, platformFee: 0.5, total: 5.5 });
});

test("fee breakdown rounds to cents exactly (edge 6 — must match server)", () => {
  // 33.33 * 0.1 = 3.333 → 3.33; total 36.66
  assert.deepEqual(feeBreakdown(33.33), { fee: 33.33, platformFee: 3.33, total: 36.66 });
  // 0.05 * 0.1 = 0.005 → rounds to 0.01; total 0.06
  assert.deepEqual(feeBreakdown(0.05), { fee: 0.05, platformFee: 0.01, total: 0.06 });
});

test("fee breakdown: zero / null / negative collapse to zero", () => {
  assert.deepEqual(feeBreakdown(0), { fee: 0, platformFee: 0, total: 0 });
  assert.deepEqual(feeBreakdown(null), { fee: 0, platformFee: 0, total: 0 });
  assert.deepEqual(feeBreakdown(undefined), { fee: 0, platformFee: 0, total: 0 });
  assert.deepEqual(feeBreakdown(-10), { fee: 0, platformFee: 0, total: 0 });
});

test("carrier payout is the full fee — the platform fee is charged to the sender, not deducted", () => {
  assert.equal(carrierPayout(50), 50);
  assert.equal(carrierPayout(33.33), 33.33);
  assert.equal(carrierPayout(0), 0);
  assert.equal(carrierPayout(null), 0);
  assert.equal(carrierPayout(-10), 0);
  // sender pays fee + platform fee; carrier receives the fee
  assert.equal(feeBreakdown(50).total - feeBreakdown(50).platformFee, carrierPayout(50));
});

test("countdown formats days, hours, minutes", () => {
  assert.equal(formatCountdown(2 * DAY + 4 * HOUR), "2d 4h left to pay");
  assert.equal(formatCountdown(5 * HOUR + 12 * 60000), "5h 12m left to pay");
  assert.equal(formatCountdown(12 * 60000), "12m left to pay");
  assert.equal(formatCountdown(0), "0m left to pay");
  assert.equal(formatCountdown(-9999), "0m left to pay"); // never goes negative
});

test("urgent under 6h, not when expired (Part 3 §7)", () => {
  assert.equal(isUrgent(5 * HOUR), true);
  assert.equal(isUrgent(7 * HOUR), false);
  assert.equal(isUrgent(0), false);
  assert.equal(isUrgent(-1), false);
});
