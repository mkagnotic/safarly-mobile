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
  /** Platform surcharge (the 10%). Present on rows from `GET /payment-handler/me`. */
  platform_fee?: number | null;
  /** Carrier net (amount minus platform fee). */
  net_amount?: number | null;
  /** Stripe references used on the receipt. */
  stripe_payment_intent_id?: string | null;
  stripe_refund_id?: string | null;
  /** Parcel route (from -> to), enriched on GET /payment-handler/me for receipts. */
  route_from?: string | null;
  route_to?: string | null;
  payer?: { id: string; name: string };
  payee?: { id: string; name: string };
}

export interface CreateIntentResult {
  /**
   * Stripe-hosted Checkout page URL. Open this in a browser (the user enters
   * their card on Stripe's page — we never touch card data). Mirrors web, which
   * does a full-page redirect to the same URL.
   */
  checkout_url: string;
  /** Checkout Session id — pass to `confirmCheckout` on return (web parity). */
  session_id: string;
  payment_intent_id: string;
  amount: number;
  platform_fee: number;
  total: number;
  currency: string;
  /** Server returns the existing pending session for a booking instead of a dup. */
  reused?: boolean;
}

export interface ConfirmPaymentResult {
  status: string; // "held"
  booking_status?: string; // "awaiting_handoff"
}

/**
 * Lifetime totals returned in `meta.summary` by `GET /payment-handler/me`
 * (independent of the current page/filter). Drives the Payments header tiles.
 */
export interface TransactionsSummary {
  total_spent: number;
  total_refunded: number;
  total_earned: number;
  count: number;
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

  /**
   * Confirm a completed Checkout session = escrow settlement. This is the
   * redirect-return fallback to the webhook (the webhook is authoritative). The
   * server verifies the session is actually `paid` with Stripe before settling,
   * so it can never settle without a real charge. Idempotency-keyed so a retried
   * confirm can't double-credit escrow. Mirrors web's `confirmPayment`.
   */
  confirmCheckout: (session_id: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<ConfirmPaymentResult>(
      "/payment-handler/confirm",
      { session_id },
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
