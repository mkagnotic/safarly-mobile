import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, messagesApi } from "@/services/api";

export interface UseUnreadInboxCountResult {
  count: number;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/** Mounted badge instances, so a screen can ask them to recount. */
const listeners = new Set<() => void>();

/**
 * Ask every mounted badge to recount now.
 *
 * Reading a thread marks its messages read on the server (a side effect of
 * `GET /messages`). The badge also hears that through the realtime `messages`
 * topic, but only if the UPDATE events arrive; the Inbox calls this when it
 * regains focus (i.e. coming back from a thread) so the badge comes down
 * whether or not realtime delivered. Web does the same by invalidating the
 * profile (`useThreadMessages`).
 */
export function refreshUnreadInboxCount(): void {
  for (const l of listeners) l();
}

/**
 * Total unread message count across all the user's VISIBLE conversations —
 * `fn_visible_unread_messages` on the server, the same number the web badge
 * reads from the profile.
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

  useEffect(() => {
    const l = () => void refetch();
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  }, [refetch]);

  return { count, loading, error, refetch };
}
