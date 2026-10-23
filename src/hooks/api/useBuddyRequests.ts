import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, buddiesApi, type BuddyRequest } from "@/services/api";
import { useSingleFlight } from "@/hooks/useSingleFlight";

export interface UseBuddyRequestsResult {
  requests: BuddyRequest[];
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Pending buddy requests. "received" (default) feeds Travel Partners →
 * "Requests received"; "sent" feeds "Sent requests", where the sender can cancel.
 */
export function useBuddyRequests(
  direction: "sent" | "received" = "received",
): UseBuddyRequestsResult {
  const [requests, setRequests] = useState<BuddyRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const flight = useSingleFlight();

  const refetch = useCallback(async () => {
    return flight.run(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await buddiesApi.getMyRequests(direction);
        if (!mountedRef.current) return;
        setRequests(res.data ?? []);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    });
  }, [direction]);

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
