import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, messagesApi } from "@/services/api";

export interface UseUnreadInboxCountResult {
  count: number;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Total unread message count across all the user's conversations.
 *
 * Subscribes to the `messages` topic on the realtime bus, so the count
 * stays live without polling. Drives the bottom-tab badge on the Inbox tab.
 *
 * Mirrors web's `useMessagesUnreadCount` query (`hooks/api/useMessages.ts`).
 */
export function useUnreadInboxCount(): UseUnreadInboxCountResult {
  const [count, setCount] = useState(0);
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
        const res = await messagesApi.unreadCount();
        if (!mountedRef.current) return;
        setCount(res.data?.unread_count ?? 0);
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

  // Realtime: any message INSERT/UPDATE/DELETE in any of the user's
  // conversations refetches the badge count.
  useRealtimeBus("messages", refetch);

  return { count, loading, error, refetch };
}
