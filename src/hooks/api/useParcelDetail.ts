import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, parcelsApi, type Parcel } from "@/services/api";

export interface UseParcelDetailResult {
  parcel: Parcel | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mirrors web's `useParcelDetail(id)` (TanStack Query) — single-resource
 * fetch from `/parcel-handler/{id}` plus realtime subscription so server-side
 * status changes (e.g. carrier accepts → status flips to in_transit) appear
 * without refresh.
 */
export function useParcelDetail(id: string | undefined): UseParcelDetailResult {
  const [parcel, setParcel] = useState<Parcel | null>(null);
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
        const res = await parcelsApi.getById(id);
        if (!mountedRef.current) return;
        setParcel(res.data ?? null);
      } catch (err) {
        if (!mountedRef.current) return;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[useParcelDetail] fetch failed for id=${id}:`, err);
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

  // Reset state when `id` changes — see useTripDetail for full explanation.
  // Prevents the render-flash where `loading=false, trip=null` falls through
  // to NotFound between route.params arriving and the refetch effect firing.
  useEffect(() => {
    setParcel(null);
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

  // Realtime: any change on parcel_requests or carrier_requests bumps the
  // parcels topic — refetch this row so the screen reflects new offers /
  // status transitions live.
  useRealtimeBus("parcels", refetch);
  useRealtimeBus("carrier-requests", refetch);

  return { parcel, loading, error, refetch };
}
