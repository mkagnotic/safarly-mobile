import { useCallback, useEffect, useRef, useState } from "react";
import { Platform } from "react-native";
import * as Notifications from "expo-notifications";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import { ApiClientError, notificationsApi } from "@/services/api";
import { useSingleFlight } from "@/hooks/useSingleFlight";

export interface UseUnreadNotificationsCountResult {
  count: number;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Total unread notifications count for the current user.
 *
 * Subscribes to the `notifications` topic on the realtime bus, so the count
 * stays live without polling. Mirrors web's `useUnreadCount` query in
 * `hooks/api/useNotifications.ts`.
 */
export function useUnreadNotificationsCount(): UseUnreadNotificationsCountResult {
  const [count, setCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const flight = useSingleFlight();

  const refetch = useCallback(async () => {
    return flight.run(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await notificationsApi.getUnreadCount();
        if (!mountedRef.current) return;
        const unread = res.data?.unread_count ?? 0;
        setCount(unread);
        // Keep the app-icon badge in step with the bell: it only moved when a push
        // arrived, so reading everything in the app left the old number (27 Oct 2026).
        if (Platform.OS !== "web") void Notifications.setBadgeCountAsync(unread).catch(() => undefined);
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

  useRealtimeBus("notifications", refetch);

  return { count, loading, error, refetch };
}
