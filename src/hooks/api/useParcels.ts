import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  parcelsApi,
  type Parcel,
  type ParcelListParams,
} from "@/services/api";

export interface UseParcelsOptions {
  /** Server-side `filter` param. Web's CustomerParcels passes `"my_parcels"`. */
  filter?: ParcelListParams["filter"];
  /** Server-side `status` filter — `undefined` = all statuses. */
  status?: ParcelListParams["status"];
  /** Items per page. Defaults to 20 (mobile-friendly; web uses 10). */
  perPage?: number;
}

export interface UseParcelsResult {
  parcels: Parcel[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  error: ApiClientError | Error | null;
  hasMore: boolean;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

/**
 * Loads the user's parcels filtered by (optional) `filter` and `status`. Re-
 * fetches whenever the filter combination changes — that's how the screen's
 * filter chips update the list.
 *
 * Single-page only for now. Pagination can be layered on by adding `page` to
 * the deps and exposing a `loadMore` (see useMyNotifications for the pattern);
 * deferred because Mahesh has fewer than per_page items in the wild.
 */
export function useParcels({
  filter,
  status,
  perPage = 20,
}: UseParcelsOptions = {}): UseParcelsResult {
  const [parcels, setParcels] = useState<Parcel[]>([]);
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
        const res = await parcelsApi.list({
          filter,
          status,
          page: 1,
          per_page: perPage,
        });
        if (!mountedRef.current) return;
        setParcels(res.data ?? []);
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
  }, [filter, status, perPage]);

  const loadMore = useCallback(async () => {
    if (loadingMore || loading || parcels.length >= total) return;
    setLoadingMore(true);
    try {
      const next = page + 1;
      const res = await parcelsApi.list({ filter, status, page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const rows = res.data ?? [];
      setParcels((prev) => {
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
  }, [loadingMore, loading, parcels.length, total, page, filter, status, perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: server-side INSERT/UPDATE/DELETE on parcel_requests refetches
  // the current page. Carrier requests also bump this topic so an offer that
  // a carrier just sent appears in the sender's "Receive" tab without refresh.
  useRealtimeBus("parcels", refetch);

  return {
    parcels,
    total,
    loading,
    loadingMore,
    error,
    hasMore: parcels.length < total,
    refetch,
    loadMore,
  };
}
