import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, buddiesApi, type BuddyRequest } from "@/services/api";

export interface UseBuddyRequestsResult {
  requests: BuddyRequest[];
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/** Pending buddy requests sent to me (Travel Partners → "Requests received"). */
export function useBuddyRequests(): UseBuddyRequestsResult {
  const [requests, setRequests] = useState<BuddyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await buddiesApi.getMyRequests("received");
        if (!mountedRef.current) return;
        setRequests(res.data ?? []);
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

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // An incoming request (or accept/reject) bumps the shared buddies topic.
  useRealtimeBus("buddies", refetch);

  return { requests, loading, error, refetch };
}
