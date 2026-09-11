import { api, newIdempotencyKey } from "./client";

/**
 * Which payment processor handled a transaction. Chosen SERVER-SIDE — the app
 * never derives it from the user's country, it only renders what it is told.
 */
export type PaymentProvider = "stripe" | "razorpay";

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
  /** Which processor moved this money — 'stripe' (US) or 'razorpay' (India). */
  payment_provider?: PaymentProvider | null;
  /** Provider-neutral references; populated for both processors. */
  provider_payment_id?: string | null;
  provider_refund_id?: string | null;
  /** Parcel route (from -> to), enriched on GET /payment-handler/me for receipts. */
  route_from?: string | null;
  route_to?: string | null;
  payer?: { id: string; name: string };
  payee?: { id: string; name: string };
}

export interface CreateIntentResult {
  /**
   * Hosted checkout page URL — a Stripe Checkout Session (US) or a Razorpay
   * Payment Link (India). Open it in a browser; the user enters their card on
   * the processor's page and we never touch card data. Both providers return
   * the same shape, so this flow has ONE code path. Mirrors web, which does a
   * full-page redirect to the same URL.
   */
  checkout_url: string;
  /** Provider order handle (Stripe Checkout Session id / Razorpay Payment Link
   *  id) — pass to `confirmCheckout` on return (web parity). */
  session_id: string;
  payment_intent_id: string;
  /** Which processor is charging. For copy only — the flow is identical. */
  provider?: PaymentProvider;
  provider_label?: string;
  amount: number;
  platform_fee: number;
  total: number;
  currency: string;
  /** Server returns the existing pending session for a booking instead of a dup. */
  reused?: boolean;
}

export interface ConfirmPaymentResult {
  status: string; // "held"
  /** The booking's ACTUAL status after settling — `payment_secured` for a
   *  handoff-first deal, `awaiting_handoff` only for a legacy escrow-first one. */
  booking_status?: string;
  booking_id?: string | null;
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

/**
 * Payout status for whichever processor pays THIS carrier — Stripe Connect in
 * the US, RazorpayX in India. `setup_kind` says HOW setup is collected:
 * 'hosted' means open `onboarding_url` in a browser; 'bank_details' means show
 * the bank-account / UPI form. Decided server-side, never from the country.
 */
export interface PayoutStatus extends StripeConnectStatus {
  provider: PaymentProvider;
  provider_label: string;
  setup_kind: "hosted" | "bank_details";
}

/** Bank account or UPI id for an Indian carrier's RazorpayX payouts. */
export type RazorpayFundAccountInput =
  | { mode: "bank_account"; account_holder_name: string; account_number: string; ifsc: string }
  | { mode: "vpa"; vpa: string; account_holder_name?: string };

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

/**
 * Deep link Stripe's hosted payout onboarding comes back to, via the web bounce
 * page at `/mobile-return`. Pass this to `WebBrowser.openAuthSessionAsync` so the
 * in-app browser closes by itself when Stripe finishes.
 */
export const PAYOUT_RETURN_URL = "safarly://payout-return";

/**
 * Deep link Stripe's hosted checkout comes back to, via the same `/mobile-return`
 * bounce page. Pass this to `WebBrowser.openAuthSessionAsync` so the in-app
 * browser closes itself the moment payment completes.
 */
export const PAYMENT_RETURN_URL = "safarly://pay-return";

export const paymentsApi = {
  /** Which processor will charge this booking. Lets the pay screen name it in
   *  its copy without the app inspecting the user's country. */
  getGateway: (booking_id: string) =>
    api.get<{ provider: PaymentProvider; provider_label: string; currency: string }>(
      "/payment-handler/gateway",
      { booking_id },
    ),

  // `platform: "mobile"` makes the server build the Stripe return URLs against
  // the deep-link bounce page instead of the web app, so paying on a device no
  // longer strands the user on a signed-out web page.
  createIntent: (booking_id: string) =>
    api.post<CreateIntentResult>("/payment-handler/create-intent", {
      booking_id,
      platform: "mobile",
    }),

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
   * `platform: "mobile"` makes the server point Stripe's `return_url` at the web
   * bounce page (`/mobile-return`), which redirects to `safarly://payout-return`.
   * Stripe won't accept a custom scheme directly, so that hop is what lets
   * `openAuthSessionAsync` close the browser and sync the status automatically.
   * Callers must still re-read `stripeConnectStatus` on return — the server is
   * authoritative, and the user can always dismiss the browser early.
   */
  stripeConnectOnboard: () =>
    api.post<{ onboarding_url: string; account_id: string }>(
      "/payment-handler/stripe-connect/onboard",
      { platform: "mobile" },
    ),

  /** Live status — the endpoint refreshes the flags from Stripe before replying. */
  stripeConnectStatus: () =>
    api.get<StripeConnectStatus>("/payment-handler/stripe-connect/status"),

  /** Stripe Express dashboard link, for an already-onboarded carrier. */
  stripeConnectDashboardLink: () =>
    api.get<{ url: string }>("/payment-handler/stripe-connect/dashboard-link"),

  // --- Provider-neutral payouts (Stripe Connect or RazorpayX) ---
  // These supersede the stripe-connect/* calls above, which stay for
  // compatibility with already-shipped builds.

  /** Payout status for this carrier's own provider, including how to set it up. */
  payoutStatus: () => api.get<PayoutStatus>("/payment-handler/payout/status"),

  /** Starts setup. A hosted provider returns an `onboarding_url` to open. */
  payoutOnboard: () =>
    api.post<{ provider: PaymentProvider; setup_kind: "hosted" | "bank_details"; onboarding_url: string | null }>(
      "/payment-handler/payout/onboard",
      { platform: "mobile" },
    ),

  /** Razorpay only: submit the carrier's bank account / UPI id. */
  submitRazorpayFundAccount: (input: RazorpayFundAccountInput) =>
    api.post<PayoutStatus>("/payment-handler/payout/razorpay/fund-account", input),

  // --- Admin endpoints ---
  adminListPayouts: (params?: { page?: number; per_page?: number }) =>
    api.get<Transaction[]>("/payment-handler/admin/payouts", params),

  adminReleasePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/release`),

  adminApprovePayout: (id: string) =>
    api.put<{ status: string }>(`/payment-handler/admin/payouts/${id}/approve`),
};
