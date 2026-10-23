import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, buddiesApi, type BuddyConnection } from "@/services/api";
import { useSingleFlight } from "@/hooks/useSingleFlight";

export interface UseBuddyConnectionsResult {
  connections: BuddyConnection[];
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/** Accepted buddy connections — drives "My buddies" (active) and Archive (rate). */
export function useBuddyConnections(): UseBuddyConnectionsResult {
  const [connections, setConnections] = useState<BuddyConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const flight = useSingleFlight();

  const refetch = useCallback(async () => {
    return flight.run(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await buddiesApi.getConnections();
        if (!mountedRef.current) return;
        setConnections(res.data ?? []);
      } catch (err) {
        if (!mountedRef.current) return;
        setError(err instanceof Error ? err : new Error(String(err)));
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Accept/complete/disconnect all mutate connections under the buddies topic.
  useRealtimeBus("buddies", refetch);

  return { connections, loading, error, refetch };
}
