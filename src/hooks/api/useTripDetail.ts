import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, tripsApi, type Trip } from "@/services/api";

export interface UseTripDetailResult {
  trip: Trip | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mirrors web's `useTripDetail(id)` — single-resource fetch from
 * `/trip-handler/{id}` plus realtime so server-side state changes (offers
 * count climbing as senders bid, status flipping when the trip closes) appear
 * without refresh.
 */
export function useTripDetail(id: string | undefined): UseTripDetailResult {
  const [trip, setTrip] = useState<Trip | null>(null);
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
        const res = await tripsApi.getById(id);
        if (!mountedRef.current) return;
        setTrip(res.data ?? null);
      } catch (err) {
        if (!mountedRef.current) return;
        if (__DEV__) {
          // eslint-disable-next-line no-console
          console.warn(`[useTripDetail] fetch failed for id=${id}:`, err);
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

  // Reset state synchronously when `id` changes — without this, useState's
  // initial-value rule keeps `loading` stale when the screen mounts with
  // `id=undefined` (hidden bottom-tab pre-mount) and only later receives the
  // real id via route params on navigation. The render between
  // "id arrived" and "useEffect fired the refetch" would otherwise show
  // `loading=false, trip=null` → NotFound flash. With this effect, the next
  // render sees `loading=true, trip=null` instead.
  useEffect(() => {
    setTrip(null);
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

  // Realtime: trip row edits + incoming carrier offers (carrier_requests
  // INSERTs bump trip.offers_count server-side, but we won't see the new
  // count until we refetch).
  useRealtimeBus("trips", refetch);
  useRealtimeBus("carrier-requests", refetch);

  return { trip, loading, error, refetch };
}
