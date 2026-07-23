import { useCallback, useEffect, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  messagesApi,
  type ActiveDeal,
  type WorkflowView,
} from "@/services/api";

export interface UseActiveDealResult {
  /** The most-recent non-terminal deal driving the pinned action, or null. */
  activeDeal: ActiveDeal | null;
  /** Server-computed FSM view — the pin is a pure projection of this. */
  workflow: WorkflowView | null;
  loading: boolean;
  error: ApiClientError | Error | null;
  refetch: () => Promise<void>;
}

/**
 * Fetches the conversation's server-owned workflow view (`/active-deal`), the
 * single source of truth for the pinned action bar. Mirrors web, which renders
 * `ChatWorkflowPin` purely from this response.
 *
 * Refreshes on every realtime topic that can move the FSM: a new offer or
 * system message (`messages`), the match handshake (`conversations`), a bid
 * accept/withdraw (`carrier-requests`), and payment/handoff/delivery
 * (`bookings` / `transactions`). That keeps the pin correct without polling.
 */
export function useActiveDeal(conversationId: string | null): UseActiveDealResult {
  const [activeDeal, setActiveDeal] = useState<ActiveDeal | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowView | null>(null);
  const [loading, setLoading] = useState(Boolean(conversationId));
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (!conversationId) {
      setActiveDeal(null);
      setWorkflow(null);
      setLoading(false);
      return;
    }
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setError(null);
      try {
        const res = await messagesApi.getActiveDeal(conversationId);
        if (!mountedRef.current) return;
        setActiveDeal(res.data?.active_deal ?? null);
        setWorkflow(res.data?.workflow ?? null);
      } catch (err) {
        if (!mountedRef.current) return;
        // A 404/403 means the conversation is gone or not ours — clear the pin
        // rather than surfacing a scary error over an otherwise-usable chat.
        if (err instanceof ApiClientError && (err.status === 404 || err.status === 403)) {
          setActiveDeal(null);
          setWorkflow(null);
        } else {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
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
    void refetch();
    return () => {
      mountedRef.current = false;
    };
  }, [refetch]);

  useRealtimeBus("messages", refetch);
  useRealtimeBus("conversations", refetch);
  useRealtimeBus("carrier-requests", refetch);
  useRealtimeBus("bookings", refetch);
  useRealtimeBus("transactions", refetch);

  return { activeDeal, workflow, loading, error, refetch };
}
