import { test } from "node:test";
import assert from "node:assert/strict";

import { isKycApprovedStatus, isKycPendingStatus } from "./kycGateStatus.ts";

test("approved statuses unlock the gate (case-insensitive)", () => {
  for (const s of ["approved", "APPROVED", "verified", "active"]) assert.equal(isKycApprovedStatus(s), true, s);
});

test("anything else keeps the gate closed — fail safe", () => {
  for (const s of ["none", "rejected", "pending", "", null, undefined]) assert.equal(isKycApprovedStatus(s), false, String(s));
});

test("pending statuses read as under review, not approved", () => {
  for (const s of ["pending", "in_review", "submitted", "processing"]) {
    assert.equal(isKycPendingStatus(s), true, s);
    assert.equal(isKycApprovedStatus(s), false, s);
  }
  assert.equal(isKycPendingStatus("approved"), false);
});
