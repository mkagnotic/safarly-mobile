import { useCallback, useRef, useState } from "react";

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
  pay: () => Promise<ConfirmPaymentResult | null>;
  clearError: () => void;
}

/**
 * Settles a booking's escrow payment: create-intent → confirm. The confirm key
 * is reused across retries of one attempt (so a network hiccup can't double
 * charge) and only regenerated after a definitive PAYMENT_FAILED decline.
 */
export function usePayBooking(bookingId: string | undefined): UsePayBookingResult {
  const [phase, setPhase] = useState<PayPhase>("idle");
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const idempotencyKeyRef = useRef<string | null>(null);

  const pay = useCallback(async (): Promise<ConfirmPaymentResult | null> => {
    if (!bookingId) return null;
    setError(null);
    setPhase("paying");
    try {
      const intent = (await paymentsApi.createIntent(bookingId)).data;
      if (!idempotencyKeyRef.current) idempotencyKeyRef.current = newIdempotencyKey();
      const res = (
        await paymentsApi.confirmPayment(intent.payment_intent_id, idempotencyKeyRef.current)
      ).data;
      bumpRealtimeTopic("bookings");
      bumpRealtimeTopic("transactions");
      setPhase("succeeded");
      return res;
    } catch (err) {
      // A definitive decline is a fresh charge next time — drop the reused key.
      if (err instanceof ApiClientError && err.code === "PAYMENT_FAILED") {
        idempotencyKeyRef.current = null;
      }
      setError(err instanceof Error ? err : new Error(String(err)));
      setPhase("idle");
      return null;
    }
  }, [bookingId]);

  const clearError = useCallback(() => setError(null), []);

  return { phase, error, pay, clearError };
}
