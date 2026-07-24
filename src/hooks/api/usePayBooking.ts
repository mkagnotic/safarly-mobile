import { useCallback, useRef, useState } from "react";
import * as WebBrowser from "expo-web-browser";

import {
  ApiClientError,
  newIdempotencyKey,
  paymentsApi,
  type ConfirmPaymentResult,
} from "@/services/api";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

export type PayPhase = "idle" | "paying" | "succeeded";

export interface UsePayBookingResult {
  phase: PayPhase;
  error: ApiClientError | Error | null;
  /**
   * The user closed Stripe's Checkout page without finishing. This is a soft
   * "not completed" state, NOT a decline/error — the caller shows an info
   * prompt, not a failure banner.
   */
  cancelled: boolean;
  pay: () => Promise<ConfirmPaymentResult | null>;
  clearError: () => void;
}

/**
 * Deep link Stripe redirects back to after the hosted Checkout page. Until the
 * server points a Checkout `success_url` here (via a small web bounce page), the
 * auth session simply won't auto-close — the user closes the browser manually
 * and we confirm on return anyway. Either way the flow is identical, so this is
 * forward-compatible with that server change.
 */
const PAYMENT_RETURN_URL = "safarly://pay-return";

/**
 * Settles a booking's escrow payment the same way web does: create a Stripe
 * Checkout session server-side, open Stripe's hosted page in an in-app browser
 * (the user enters their card on Stripe — we never touch card data), then
 * confirm by session id on return.
 *
 * The webhook is the authoritative settlement path; this client confirm is the
 * redirect-return fallback. The confirm is idempotency-keyed and the server
 * re-verifies the session is actually `paid` with Stripe, so escrow can never
 * settle without a real charge and a retried confirm can't double-credit.
 */
export function usePayBooking(bookingId: string | undefined): UsePayBookingResult {
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const idempotencyKeyRef = useRef<string | null>(null);

  const pay = useCallback(async (): Promise<ConfirmPaymentResult | null> => {
    if (!bookingId) return null;
    setError(null);
    setCancelled(false);
    setPhase("paying");
    try {
      // 1. Create (or reuse) the Checkout session. This is where the server
      //    gates on ownership / KYC / verification / capacity — those surface
      //    as ApiClientErrors and fall through to the catch below.
      const intent = (await paymentsApi.createIntent(bookingId)).data;

      // 2. Open Stripe's hosted Checkout in an in-app browser session. Resolves
      //    when the deep-link return fires ('success') OR the user closes the
      //    browser ('cancel'/'dismiss'). We don't trust the result type — we
      //    always verify with the server next.
      await WebBrowser.openAuthSessionAsync(intent.checkout_url, PAYMENT_RETURN_URL);

      // 3. Confirm by session. The webhook may already have settled; confirm is
      //    idempotent and re-checks the session is really paid.
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();
      try {
        const res = (
          await paymentsApi.confirmCheckout(intent.session_id, idempotencyKeyRef.current)
        ).data;
        bumpRealtimeTopic("bookings");
        bumpRealtimeTopic("transactions");
        setPhase("succeeded");
        return res;
      } catch (err) {
        // Session isn't paid → the user backed out of Stripe before finishing.
        // A fresh attempt gets a brand-new charge, so drop the reused key.
        if (err instanceof ApiClientError && err.code === "PAYMENT_FAILED") {
          idempotencyKeyRef.current = null;
          setCancelled(true);
          setPhase("idle");
          return null;
        }
        throw err;
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setPhase("idle");
      return null;
    }
  }, [bookingId]);

  const clearError = useCallback(() => setError(null), []);

  return { phase, error, cancelled, pay, clearError };
}
