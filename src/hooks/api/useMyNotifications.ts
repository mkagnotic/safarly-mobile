import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  notificationsApi,
  type Notification,
} from "@/services/api";

export interface UseMyNotificationsOptions {
  /** Items per page. Defaults to 20 (mobile-friendly; web uses 15). */
  perPage?: number;
}

export interface UseMyNotificationsResult {
  notifications: Notification[];
  loading: boolean;
  error: ApiClientError | Error | null;
  /** True while a `markAsRead` is in flight, even though the UI updates optimistically. */
  marking: boolean;
  /** True while a `markAllAsRead` is in flight. */
  markingAll: boolean;
  /** Re-fetch the first page from scratch. */
  refetch: () => Promise<void>;
  /** Mark a single notification as read. Optimistic, with rollback on failure. */
  markAsRead: (id: string) => Promise<void>;
  /** Mark every loaded notification as read. Optimistic. */
  markAllAsRead: () => Promise<void>;
}

/**
 * Loads the user's notifications and exposes optimistic mark-as-read
 * mutations. Mirrors web's `useNotifications` + `useMarkAsRead` +
 * `useMarkAllAsRead` triplet, collapsed into one hook because we don't have
 * React Query's auto-invalidation here — keeping state local to one hook
 * avoids the "two sources of truth" problem.
 */
export function useMyNotifications(
  options: UseMyNotificationsOptions = {},
): UseMyNotificationsResult {
  const { perPage = 20 } = options;

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [marking, setMarking] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await notificationsApi.list({ page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setNotifications(res.data ?? []);
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
  }, [perPage]);

  useEffect(() => {
    mountedRef.current = true;
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  // Realtime: refetch on every notification INSERT/UPDATE for the user.
  useRealtimeBus("notifications", refetch);

  const markAsRead = useCallback(async (id: string) => {
    // Snapshot so we can rollback exactly the row we changed.
    let snapshot: Notification[] | null = null;
    setNotifications((prev) => {
      snapshot = prev;
      return prev.map((n) => (n.id === id && !n.read ? { ...n, read: true } : n));
    });
    setMarking(true);
    try {
      await notificationsApi.markAsRead(id);
    } catch (err) {
      if (snapshot && mountedRef.current) setNotifications(snapshot);
      throw err;
    } finally {
      if (mountedRef.current) setMarking(false);
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    let snapshot: Notification[] | null = null;
    setNotifications((prev) => {
      snapshot = prev;
      return prev.map((n) => (n.read ? n : { ...n, read: true }));
    });
    setMarkingAll(true);
    try {
      await notificationsApi.markAllAsRead();
    } catch (err) {
      if (snapshot && mountedRef.current) setNotifications(snapshot);
      throw err;
    } finally {
      if (mountedRef.current) setMarkingAll(false);
    }
  }, []);

  return {
    notifications,
    loading,
    error,
    marking,
    markingAll,
    refetch,
    markAsRead,
    markAllAsRead,
  };
}
