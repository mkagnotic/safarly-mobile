import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  buddiesApi,
  type BuddyListing,
} from "@/services/api";

export interface UseBuddyListingsOptions {
  /** Server-side `filter` param. Web uses `"my_listings"` for the Travel Partners tab. */
  filter?: string;
  /** Items per page. Defaults to 20. */
  perPage?: number;
}

export interface UseBuddyListingsResult {
  listings: BuddyListing[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

export function useBuddyListings({
  filter,
  perPage = 20,
}: UseBuddyListingsOptions = {}): UseBuddyListingsResult {
  const [listings, setListings] = useState<BuddyListing[]>([]);
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
        const res = await buddiesApi.list({ filter, page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setListings(res.data ?? []);
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
    if (loadingMore || loading || listings.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await buddiesApi.list({ filter, page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const rows = res.data ?? [];
      setListings((prev) => {
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
  }, [loadingMore, loading, listings.length, total, page, filter, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: any change to a `buddy_listings` row this user owns refetches.
  // Buddy_requests bumps the same topic so an incoming request reflows here too.
  useRealtimeBus("buddies", refetch);

  return {
    listings,
    total,
    loading,
    loadingMore,
    error,
    hasMore: listings.length < total,
    refetch,
    loadMore,
  };
}
