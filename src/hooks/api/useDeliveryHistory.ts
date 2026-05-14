import { useCallback, useEffect, useRef, useState } from "react";

import {
  ApiClientError,
  messagesApi,
  type DeliveryHistoryItem,
} from "@/services/api";

export interface UseDeliveryHistoryOptions {
  conversationId: string | null;
  /** Only fetch when this is true (matches web's `enabled` query flag). */
  enabled: boolean;
}

export interface UseDeliveryHistoryResult {
  items: DeliveryHistoryItem[];
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Mirrors web's `useDeliveryHistory(conversationId, enabled)` query — single
 * GET that lists past deliveries between the two participants. No mutations.
 *
 * Fetches once when `enabled` flips true; refetches on `refetch()`.
 */
export function useDeliveryHistory({
  conversationId,
  enabled,
}: UseDeliveryHistoryOptions): UseDeliveryHistoryResult {
  const [items, setItems] = useState<DeliveryHistoryItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (!conversationId) return;
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await messagesApi.getDeliveryHistory(conversationId);
        if (!mountedRef.current) return;
        setItems(res.data ?? []);
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
  }, [conversationId]);

  useEffect(() => {
    mountedRef.current = true;
    if (enabled && conversationId) void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [enabled, conversationId, refetch]);

  return { items, loading, error, refetch };
}
