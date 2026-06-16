import { api, newIdempotencyKey } from "./client";

export interface Transaction {
  id: string;
  booking_id: string | null;
  payer_id: string | null;
  payee_id: string | null;
  amount: number;
  fee: number;
  net: number;
  currency: string;
  type: string;
  status: string;
  method: string | null;
  reference: string | null;
  created_at: string;
  payer?: { id: string; name: string };
  payee?: { id: string; name: string };
}

export interface CreateIntentResult {
  client_secret: string;
  payment_intent_id: string;
  amount: number;
  platform_fee: number;
  total: number;
  /** Server returns the existing pending intent for a booking instead of a dup. */
  reused?: boolean;
}

export interface ConfirmPaymentResult {
  status: string; // "held"
  booking_status?: string; // "awaiting_handoff"
}

export const paymentsApi = {
  createIntent: (booking_id: string) =>
    api.post<CreateIntentResult>("/payment-handler/create-intent", { booking_id }),

  /** Confirm = escrow settlement; idempotency-keyed against double charges. */
  confirmPayment: (payment_intent_id: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<ConfirmPaymentResult>(
      "/payment-handler/confirm",
      { payment_intent_id },
      { idempotencyKey },
    ),

  releasePayment: (id: string) =>
    api.post<{ status: string }>(`/payment-handler/${id}/release`),

  refundPayment: (id: string, amount?: number, reason?: string) =>
    api.post<{ status: string }>(`/payment-handler/${id}/refund`, { amount, reason }),

  getMyTransactions: (params?: { page?: number; per_page?: number }) =>
    api.get<Transaction[]>("/payment-handler/me", params),

  // --- Admin endpoints ---
  adminListPayouts: (params?: { page?: number; per_page?: number }) =>
    api.get<Transaction[]>("/payment-handler/admin/payouts", params),

  adminReleasePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/release`),

  adminApprovePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/approve`),
};
