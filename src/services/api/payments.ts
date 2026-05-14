import { api } from "./client";

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

export const paymentsApi = {
  createIntent: (booking_id: string) =>
    api.post<{ client_secret: string; amount: number; total: number }>(
      "/payment-handler/create-intent",
      { booking_id },
    ),

  confirmPayment: (payment_intent_id: string) =>
    api.post<{ status: string }>("/payment-handler/confirm", { payment_intent_id }),

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
