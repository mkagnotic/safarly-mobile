import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, parcelsApi, type Parcel } from "@/services/api";

export interface UseOpportunitiesOptions {
  perPage?: number;
}

export interface UseOpportunitiesResult {
  opportunities: Parcel[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Mirrors web's `useParcelOpportunities({ page, per_page })` (TanStack
 * Query) — paginated list of parcels matching the user's listed trips.
 * Uses the same load-more pattern as `useActivityFeed` and `useUserReviews`.
 *
 * Realtime: a new parcel matching the user's route bumps the `parcels`
 * topic; an accepted bid (carrier-requests) closes a parcel and removes
 * it from opportunities. Both refetch.
 */
export function useOpportunities({
  perPage = 12,
}: UseOpportunitiesOptions = {}): UseOpportunitiesResult {
  const [opportunities, setOpportunities] = useState<Parcel[]>([]);
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
        const res = await parcelsApi.findOpportunities({ page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setOpportunities(res.data ?? []);
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
  }, [perPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading) return;
    if (opportunities.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await parcelsApi.findOpportunities({ page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const newRows = res.data ?? [];
      setOpportunities((prev) => {
        const seen = new Set(prev.map((r) => r.id));
        return [...prev, ...newRows.filter((r) => !seen.has(r.id))];
      });
      setTotal(res.meta?.total ?? total);
      setPage(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, loading, opportunities.length, total, page, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // New matching parcels and accepted bids both bump the visible list.
  useRealtimeBus("parcels", refetch);
  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("trips", refetch); // user listing a new trip surfaces new matches

  return {
    opportunities,
    total,
    loading,
    loadingMore,
    error,
    hasMore: opportunities.length < total,
    refetch,
    loadMore,
  };
}
