import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  bookingsApi,
  type Booking,
  type BookingDetailResponse,
} from "@/services/api";

export interface UseBookingDetailResult {
  booking: Booking | null;
  payment: BookingDetailResponse["payment"];
  timeline: BookingDetailResponse["timeline"];
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mirrors web's `useBookingDetail(id)` — single-resource fetch from
 * `/booking-handler/{id}` plus realtime for status flips (pickup, OTP confirm,
 * cancellation). Resets state on id change to avoid the
 * `loading=false, booking=null → NotFound` flash that bit ParcelDetails /
 * TripDetails before — same fix template applied here.
 */
export function useBookingDetail(id: string | undefined): UseBookingDetailResult {
  const [booking, setBooking] = useState<Booking | null>(null);
  const [payment, setPayment] = useState<BookingDetailResponse["payment"]>(null);
  const [timeline, setTimeline] = useState<BookingDetailResponse["timeline"]>([]);
  const [loading, setLoading] = useState(Boolean(id));
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (!id) return;
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await bookingsApi.getById(id);
        if (!mountedRef.current) return;
        setBooking(res.data?.booking ?? null);
        setPayment(res.data?.payment ?? null);
        setTimeline(res.data?.timeline ?? []);
      } catch (err) {
        if (!mountedRef.current) return;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[useBookingDetail] fetch failed for id=${id}:`, err);
        }
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current) setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [id]);

  // Reset on id change — same race-fix as useTripDetail / useParcelDetail.
  useEffect(() => {
    setBooking(null);
    setPayment(null);
    setTimeline([]);
    setError(null);
    setLoading(Boolean(id));
  }, [id]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: booking row edits (pickup/cancel/OTP) + transaction status
  // flips (escrow release on confirm-OTP) both refetch the page.
  useRealtimeBus("bookings", refetch);
  useRealtimeBus("transactions", refetch);

  return { booking, payment, timeline, loading, error, refetch };
}
