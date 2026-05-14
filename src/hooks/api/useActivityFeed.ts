import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, feedApi, type FeedItem } from "@/services/api";

export interface UseActivityFeedOptions {
  /**
   * Items per page. Web uses 4 on Home and 12 on `/customer/activity`.
   * Default to 4 for parity with Home so this hook can be used unchanged
   * by both surfaces.
   */
  perPage?: number;
  /**
   * `false` (default) → single-page mode (Home). The hook ignores `loadMore`
   * and always shows the first `perPage` items.
   * `true` → paginated mode (AllActivityScreen). `loadMore` appends the next
   * page; `hasMore` flips when the server reports we've consumed all rows.
   */
  paginate?: boolean;
}

export interface UseActivityFeedResult {
  items: FeedItem[];
  loading: boolean;
  /** True only while a `loadMore` is in flight (not the initial load). */
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  total: number;
  /** True when there are still more pages to fetch (paginated mode only). */
  hasMore: boolean;
  refetch: () => Promise<void>;
  /** Append the next page. No-op when not in paginated mode or already loading. */
  loadMore: () => Promise<void>;
}

/**
 * Mirrors web's activity-feed query (`useActivityFeed`/`useFeed.ts`). Mobile
 * uses the realtime bus pattern — the feed reflects activity across parcels,
 * trips, bookings, carrier requests, and messages, so we subscribe to all of
 * those topics and refetch when any of them tick.
 *
 * Single-page mode is the original behavior (Home's "Activity" section).
 * Paginated mode is what the dedicated `/customer/activity` page uses —
 * mobile's AllActivityScreen calls `loadMore()` when the user taps the
 * "Load more" button.
 */
export function useActivityFeed({
  perPage = 4,
  paginate = false,
}: UseActivityFeedOptions = {}): UseActivityFeedResult {
  const [items, setItems] = useState<FeedItem[]>([]);
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
        const res = await feedApi.list({ page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setItems(res.data ?? []);
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
    if (!paginate) return;
    if (loadingMore || loading) return;
    if (items.length >= total) return; // no more pages
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await feedApi.list({ page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const newItems = res.data ?? [];
      // De-dupe by id in case the server returns overlapping rows during a
      // realtime-driven refetch race.
      setItems((prev) => {
        const seen = new Set(prev.map((i) => i.id));
        return [...prev, ...newItems.filter((i) => !seen.has(i.id))];
      });
      setTotal(res.meta?.total ?? total);
      setPage(next);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err instanceof Error ? err : new Error(String(err)));
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [paginate, loadingMore, loading, items.length, total, page, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Activity feed is a roll-up of multiple resources — bump on any of them.
  // Realtime bumps reset to page 1 (refetch) — same behavior as web's
  // TanStack invalidation.
  useRealtimeBus("parcels", refetch);
  useRealtimeBus("trips", refetch);
  useRealtimeBus("bookings", refetch);
  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("messages", refetch);

  return {
    items,
    loading,
    loadingMore,
    error,
    total,
    hasMore: paginate && items.length < total,
    refetch,
    loadMore,
  };
}
