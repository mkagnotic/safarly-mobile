import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, bookingsApi, type Booking } from "@/services/api";

export interface UseBookingsOptions {
  /** Server-side `role` filter — `"sender"` | `"carrier"` | undefined (both). */
  role?: string;
  /**
   * Server-side `status` filter. Web's filter chips map to:
   * Active → `"active"` (server expands to in_transit/confirmed/etc.)
   * Completed → `"delivered"`
   * Cancelled → `"cancelled"`
   */
  status?: string;
  perPage?: number;
}

export interface UseBookingsResult {
  bookings: Booking[];
  total: number;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mirrors web's `useBookings` (TanStack Query) — list-of-bookings with
 * realtime so accepted offers / OTP confirmations / cancellations reflect
 * without a manual refresh.
 */
export function useBookings({
  role,
  status,
  perPage = 20,
}: UseBookingsOptions = {}): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await bookingsApi.list({ role, status, page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setBookings(res.data ?? []);
        setTotal(res.meta?.total ?? res.data?.length ?? 0);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current) setLoading(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [role, status, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: bookings INSERT/UPDATE + carrier-requests acceptance both bump
  // this list. Transactions can flip booking.status (escrow release) too.
  useRealtimeBus("bookings", refetch);
  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("transactions", refetch);

  return { bookings, total, loading, error, refetch };
}
