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
  /** True while a `clearAll` is in flight. */
  clearing: boolean;
  /** More pages are available (drives infinite scroll). */
  hasMore: boolean;
  /** True while a `loadMore` page fetch is in flight. */
  loadingMore: boolean;
  /** Re-fetch the first page from scratch. */
  refetch: () => Promise<void>;
  /** Fetch and append the next page. */
  loadMore: () => Promise<void>;
  /** Mark a single notification as read. Optimistic, with rollback on failure. */
  markAsRead: (id: string) => Promise<void>;
  /** Mark every loaded notification as read. Optimistic. */
  markAllAsRead: () => Promise<void>;
  /** Delete a single notification. Optimistic, with rollback on failure. */
  remove: (id: string) => Promise<void>;
  /** Clear all of the user's notifications. Optimistic, with rollback. */
  clearAll: () => Promise<void>;
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
  const [clearing, setClearing] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const pageRef = useRef(1);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await notificationsApi.list({ page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        const rows = res.data ?? [];
        setNotifications(rows);
        pageRef.current = 1;
        setHasMore(rows.length >= perPage);
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

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || inFlightRef.current) return;
    setLoadingMore(true);
    try {
      const next = pageRef.current + 1;
      const res = await notificationsApi.list({ page: next, per_page: perPage });
      if (!mountedRef.current) return;
      const rows = res.data ?? [];
      setNotifications((prev) => {
        // De-dupe on id — a realtime refetch could overlap a page append.
        const seen = new Set(prev.map((n) => n.id));
        return [...prev, ...rows.filter((n) => !seen.has(n.id))];
      });
      pageRef.current = next;
      setHasMore(rows.length >= perPage);
    } catch {
      // A failed page-load shouldn't wipe what's already on screen; leave as-is.
    } finally {
      if (mountedRef.current) setLoadingMore(false);
    }
  }, [loadingMore, hasMore, perPage]);

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

  const remove = useCallback(async (id: string) => {
    let snapshot: Notification[] | null = null;
    setNotifications((prev) => {
      snapshot = prev;
      return prev.filter((n) => n.id !== id);
    });
    try {
      await notificationsApi.remove(id);
    } catch (err) {
      if (snapshot && mountedRef.current) setNotifications(snapshot);
      throw err;
    }
  }, []);

  const clearAll = useCallback(async () => {
    let snapshot: Notification[] | null = null;
    setNotifications((prev) => {
      snapshot = prev;
      return [];
    });
    setClearing(true);
    setHasMore(false);
    try {
      await notificationsApi.clearAll();
    } catch (err) {
      if (snapshot && mountedRef.current) setNotifications(snapshot);
      throw err;
    } finally {
      if (mountedRef.current) setClearing(false);
    }
  }, []);

  return {
    notifications,
    loading,
    error,
    marking,
    markingAll,
    clearing,
    hasMore,
    loadingMore,
    refetch,
    loadMore,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
  };
}
