/**
 * How `/kyc-handler/status` → `status` is read by gates (e.g. Pay). Pure, so
 * the node test runner can exercise it without React Native.
 */
const APPROVED = new Set(["approved", "verified", "active"]);
const PENDING = new Set(["pending", "in_review", "submitted", "processing"]);

export const isKycApprovedStatus = (status: string | null | undefined): boolean =>
  APPROVED.has((status ?? "").toLowerCase());

export const isKycPendingStatus = (status: string | null | undefined): boolean =>
  PENDING.has((status ?? "").toLowerCase());
