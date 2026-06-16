import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  tripsApi,
  type Trip,
  type TripListParams,
} from "@/services/api";

export interface UseTripsOptions {
  /** Server-side `filter` param. Web uses `"my_trips"` and `"my_archived"`. */
  filter?: TripListParams["filter"];
  /** Items per page. Defaults to 20 (mobile-friendly; web uses 10). */
  perPage?: number;
}

export interface UseTripsResult {
  trips: Trip[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Loads trips filtered by the optional `filter` param. Mirrors web's
 * `useTrips` hook in shape; collapsed to a single hook because mobile
 * screens use it for "My Flights" and "Archive" with different filters.
 */
export function useTrips({ filter, perPage = 20 }: UseTripsOptions = {}): UseTripsResult {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await tripsApi.list({ filter, page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setTrips(res.data ?? []);
        setTotal(res.meta?.total ?? res.data?.length ?? 0);
        setPage(1);
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
  }, [filter, perPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || trips.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await tripsApi.list({ filter, page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const rows = res.data ?? [];
      setTrips((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...rows.filter((r) => !seen.has(r.id))];
      });
      setTotal(res.meta?.total ?? total);
      setPage(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, trips.length, total, page, filter, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: any change to a `travel_listings` row this user owns refetches.
  useRealtimeBus("trips", refetch);

  return {
    trips,
    total,
    loading,
    loadingMore,
    error,
    hasMore: trips.length < total,
    refetch,
    loadMore,
  };
}
