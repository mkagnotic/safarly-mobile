import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, buddiesApi, type BuddyListing } from "@/services/api";

export interface UseBuddyListingDetailResult {
  listing: BuddyListing | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * `buddy-handler` has no `GET /:id` endpoint — we resolve the row from
 * `list({ filter: "my_listings" })`, which inherits the server-side
 * soft-delete filter for free.
 */
export function useBuddyListingDetail(
  id: string | undefined,
): UseBuddyListingDetailResult {
  const [listing, setListing] = useState<BuddyListing | null>(null);
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
        const res = await buddiesApi.list({ filter: "my_listings", page: 1, per_page: 100 });
        if (!mountedRef.current) return;
        const found = (res.data ?? []).find((row) => row.id === id) ?? null;
        setListing(found);
      } catch (err) {
        if (!mountedRef.current) return;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[useBuddyListingDetail] fetch failed for id=${id}:`, err);
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

  // Reset on id change so the not-found branch can't flash between
  // route.params arriving and refetch settling.
  useEffect(() => {
    setListing(null);
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

  useRealtimeBus("buddies", refetch);

  return { listing, loading, error, refetch };
}
