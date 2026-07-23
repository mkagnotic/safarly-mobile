import { useCallback, useEffect, useRef, useState } from "react";

import { ApiClientError, disputesApi, type Dispute } from "@/services/api";

export interface UseMyDisputesResult {
  disputes: Dispute[];
  total: number;
  loading: boolean;
  loadingMore: boolean;
  hasMore: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
  loadMore: () => Promise<void>;
}

const PER_PAGE = 10;

/**
 * Loads the signed-in user's disputes from `GET /dispute-handler/me` (web
 * parity: `useMyDisputes`). The list payload carries nested `evidence_files` +
 * `messages`, so the accordion detail reads straight from it — no per-id fetch.
 * Infinite scroll via `loadMore`; `refetch` resets to page 1 (pull-to-refresh,
 * after filing / messaging). No realtime — disputes have no bus topic; the web
 * relies on refetch/invalidation too.
 */
export function useMyDisputes(): UseMyDisputesResult {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
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
        const res = await disputesApi.getMyDisputes({ page: 1, per_page: PER_PAGE });
        if (!mountedRef.current) return;
        setDisputes(res.data ?? []);
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
  }, []);

  const loadMore = useCallback(async () => {
    if (inFlightRef.current || loading || loadingMore) return;
    if (disputes.length >= total) return;

    const nextPage = pageRef.current + 1;
    const promise = (async () => {
      setLoadingMore(true);
      try {
        const res = await disputesApi.getMyDisputes({ page: nextPage, per_page: PER_PAGE });
        if (!mountedRef.current) return;
        const incoming = res.data ?? [];
        setDisputes((prev) => {
          const seen = new Set(prev.map((d) => d.id));
          return [...prev, ...incoming.filter((d) => !seen.has(d.id))];
        });
        if (typeof res.meta?.total === "number") setTotal(res.meta.total);
        pageRef.current = nextPage;
      } catch {
        // Leave the loaded set intact; user can pull-to-refresh.
      } finally {
        if (mountedRef.current) setLoadingMore(false);
        inFlightRef.current = null;
      }
    })();
    inFlightRef.current = promise;
    return promise;
  }, [loading, loadingMore, disputes.length, total]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  return {
    disputes,
    total,
    loading,
    loadingMore,
    hasMore: disputes.length < total,
    error,
    refetch,
    loadMore,
  };
}
