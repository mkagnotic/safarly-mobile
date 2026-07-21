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

export interface StripeConnectStatus {
  /** Both charges AND payouts enabled — the only state that clears the payout gate. */
  connected: boolean;
  charges_enabled: boolean;
  payouts_enabled: boolean;
  /** Stripe's forms were completed; verification may still be in progress. */
  details_submitted: boolean;
  account_id: string | null;
}

/** Started onboarding but Stripe hasn't enabled payouts yet. */
export function isPayoutPending(status: StripeConnectStatus | null): boolean {
  return !!status && status.details_submitted && !status.payouts_enabled;
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

  // --- Stripe Connect (carrier payouts) ---

  /**
   * Create (or reuse) the carrier's Express account and return a hosted
   * onboarding link.
   *
   * The link's `return_url` is built server-side from `APP_URL`, so Stripe
   * always sends the user to the *web* payout page — there's no mobile deep
   * link to come back to. Callers therefore treat "the browser closed" as the
   * signal to re-read `stripeConnectStatus`, which is authoritative either way.
   */
  stripeConnectOnboard: () =>
    api.post<{ onboarding_url: string; account_id: string }>(
      "/payment-handler/stripe-connect/onboard",
    ),

  /** Live status — the endpoint refreshes the flags from Stripe before replying. */
  stripeConnectStatus: () =>
    api.get<StripeConnectStatus>("/payment-handler/stripe-connect/status"),

  /** Stripe Express dashboard link, for an already-onboarded carrier. */
  stripeConnectDashboardLink: () =>
    api.get<{ url: string }>("/payment-handler/stripe-connect/dashboard-link"),

  // --- Admin endpoints ---
  adminListPayouts: (params?: { page?: number; per_page?: number }) =>
    api.get<Transaction[]>("/payment-handler/admin/payouts", params),

  adminReleasePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/release`),

  adminApprovePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/approve`),
};
