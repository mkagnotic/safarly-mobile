import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  messagesApi,
  type Conversation,
} from "@/services/api";

export interface UseMyConversationsOptions {
  /** Items per page. Defaults to 50 (mobile-friendly; web uses default). */
  perPage?: number;
  /** Logged-in user id — used to filter self-chats and identify match-request direction. */
  currentUserId: string | null;
}

export interface UseMyConversationsResult {
  conversations: Conversation[];
  loading: boolean;
  error: ApiClientError | Error | null;
  /** True while a `markX` mutation is in flight; UI updates optimistically anyway. */
  mutating: boolean;
  refetch: () => Promise<void>;
  /** Optimistically accept an incoming match request. */
  acceptMatch: (conversationId: string) => Promise<void>;
  /** Optimistically decline an incoming match request. */
  declineMatch: (conversationId: string, reason?: string) => Promise<void>;
  /**
   * Local-only: clear `unread_count` for one row. Use this when the user opens
   * a conversation, so the inbox card drops its unread highlight instantly —
   * the server already marks read on `GET /messages` and the realtime bus
   * eventually reconciles, but the optimistic patch makes the UX feel snappy.
   */
  markConversationRead: (conversationId: string) => void;
}

/**
 * Loads conversations + applies the same dedupe-by-participant logic web uses
 * (covers legacy rows that were created per-context before the backend started
 * collapsing them). Sorts by most recent activity. Provides optimistic accept
 * and decline mutations for the inbox.
 */
export function useMyConversations({
  perPage = 50,
  currentUserId,
}: UseMyConversationsOptions): UseMyConversationsResult {
  const [rawConversations, setRawConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [mutating, setMutating] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);

  const refetch = useCallback(async () => {
    if (inFlightRef.current) return inFlightRef.current;

    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await messagesApi.listConversations({ page: 1, per_page: perPage });
        if (!mountedRef.current) return;
        setRawConversations(res.data ?? []);
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

  // Realtime: refetch when a `conversations` row changes OR when a new
  // message lands in any conversation (so the row preview / unread count /
  // sort order stay live without pull-to-refresh — the WhatsApp-list feel).
  useRealtimeBus("conversations", refetch);
  useRealtimeBus("messages", refetch);

  // Web parity: dedupe by participant id (prefer matched > pending, then most
  // recent activity), then sort by last_message_at desc.
  const conversations = useMemo<Conversation[]>(() => {
    const rows = rawConversations.filter(
      (c) =>
        c.participant_1 !== c.participant_2 &&
        c.participant?.id !== currentUserId,
    );
    const bestByParticipant = new Map<string, Conversation>();
    for (const c of rows) {
      const key = c.participant?.id;
      if (!key) continue;
      const current = bestByParticipant.get(key);
      if (!current) {
        bestByParticipant.set(key, c);
        continue;
      }
      const currentMatched = current.match_status === "matched";
      const cMatched = c.match_status === "matched";
      if (cMatched && !currentMatched) {
        bestByParticipant.set(key, c);
        continue;
      }
      if (!cMatched && currentMatched) continue;
      const currentTs = current.last_message_at ? new Date(current.last_message_at).getTime() : 0;
      const cTs = c.last_message_at ? new Date(c.last_message_at).getTime() : 0;
      if (cTs > currentTs) bestByParticipant.set(key, c);
    }
    return Array.from(bestByParticipant.values()).sort((a, b) => {
      const at = a.last_message_at ? new Date(a.last_message_at).getTime() : 0;
      const bt = b.last_message_at ? new Date(b.last_message_at).getTime() : 0;
      return bt - at;
    });
  }, [rawConversations, currentUserId]);

  /** Patch one row in the underlying list. */
  const patch = useCallback((id: string, updater: (c: Conversation) => Conversation) => {
    setRawConversations((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }, []);

  const acceptMatch = useCallback(
    async (conversationId: string) => {
      let snapshot: Conversation[] | null = null;
      setRawConversations((prev) => {
        snapshot = prev;
        return prev.map((c) => {
          if (c.id !== conversationId) return c;
          // Two-phase match flow (server: message-handler/index.ts:155-261).
          //   Phase 1 — first to call /match: server stamps `matched_by` to
          //     the caller and KEEPS status pending until the other side
          //     confirms. Optimistically reflect that locally so the UI
          //     shows "Waiting for X" instead of briefly flashing "Matched".
          //   Phase 2 — other side already called /match: server flips
          //     status to "matched" and stamps `matched_at`. Optimistic
          //     state can mirror that immediately.
          const otherSideRequested = !!c.matched_by && c.matched_by !== currentUserId;
          if (otherSideRequested) {
            return {
              ...c,
              match_status: "matched",
              matched_at: new Date().toISOString(),
            };
          }
          return {
            ...c,
            matched_by: currentUserId ?? c.matched_by,
          };
        });
      });
      setMutating(true);
      try {
        const res = await messagesApi.matchConversation(conversationId);
        if (mountedRef.current && res.data) {
          patch(conversationId, () => res.data);
        }
      } catch (err) {
        if (mountedRef.current) {
          if (snapshot) setRawConversations(snapshot);
          // Resync if a guard rejected because the other side acted first.
          void refetch();
        }
        throw err;
      } finally {
        if (mountedRef.current) setMutating(false);
      }
    },
    [patch, currentUserId, refetch],
  );

  const markConversationRead = useCallback((conversationId: string) => {
    setRawConversations((prev) =>
      prev.map((c) => (c.id === conversationId && c.unread_count > 0 ? { ...c, unread_count: 0 } : c)),
    );
  }, []);

  const declineMatch = useCallback(
    async (conversationId: string, reason?: string) => {
      let snapshot: Conversation[] | null = null;
      setRawConversations((prev) => {
        snapshot = prev;
        return prev.map((c) =>
          c.id === conversationId
            ? {
                ...c,
                match_status: "declined",
                declined_at: new Date().toISOString(),
                decline_reason: reason ?? null,
              }
            : c,
        );
      });
      setMutating(true);
      try {
        const res = await messagesApi.declineConversation(conversationId, reason);
        if (mountedRef.current && res.data) {
          patch(conversationId, () => res.data);
        }
      } catch (err) {
        if (mountedRef.current) {
          if (snapshot) setRawConversations(snapshot);
          // Decline only works from `pending`; resync if the state moved.
          void refetch();
        }
        throw err;
      } finally {
        if (mountedRef.current) setMutating(false);
      }
    },
    [patch, refetch],
  );

  return {
    conversations,
    loading,
    error,
    mutating,
    refetch,
    acceptMatch,
    declineMatch,
    markConversationRead,
  };
}
