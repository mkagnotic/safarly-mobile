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
  /** True while the next page is being appended (infinite scroll). */
  loadingMore: boolean;
  /** More pages remain to load. */
  hasMore: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
  /** Fetch + append the next page. No-op while loading, done, or in flight. */
  loadMore: () => Promise<void>;
}

/**
 * Mirrors web's `useBookings` (TanStack Query) — list-of-bookings with
 * realtime so accepted offers / OTP confirmations / cancellations reflect
 * without a manual refresh. Web paginates with a numbered pager; mobile does
 * infinite scroll instead, so this hook accumulates pages via `loadMore` and
 * resets to page 1 on `refetch` (pull-to-refresh, filter change, realtime).
 */
export function useBookings({
  role,
  status,
  perPage = 20,
}: UseBookingsOptions = {}): UseBookingsResult {
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pageRef = useRef(1);

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
        pageRef.current = 1;
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

  const loadMore = useCallback(async () => {
    // Nothing to do while the first page is loading, a request is in flight, or
    // we've already got everything.
    if (inFlightRef.current || loading || loadingMore) return;
    if (bookings.length >= total) return;

    const nextPage = pageRef.current + 1;
    const promise = (async () => {
      setLoadingMore(true);
      try {
        const res = await bookingsApi.list({ role, status, page: nextPage, per_page: perPage });
        if (!mountedRef.current) return;
        const incoming = res.data ?? [];
        // Dedupe by id — a booking that changed page between fetches (e.g. a new
        // insert shifted the window) must not render twice.
        setBookings((prev) => {
          const seen = new Set(prev.map((b) => b.id));
          return [...prev, ...incoming.filter((b) => !seen.has(b.id))];
        });
        if (typeof res.meta?.total === "number") setTotal(res.meta.total);
        pageRef.current = nextPage;
      } catch {
        // Swallow — a failed page-append leaves the loaded set intact; the user
        // can pull-to-refresh. (First-page errors surface via `error`.)
      } finally {
        if (mountedRef.current) setLoadingMore(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [role, status, perPage, loading, loadingMore, bookings.length, total]);

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

  return {
    bookings,
    total,
    loading,
    loadingMore,
    hasMore: bookings.length < total,
    error,
    refetch,
    loadMore,
  };
}
