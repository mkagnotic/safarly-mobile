import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useRealtimeBus } from "@/hooks/realtime/useRealtimeBus";
import {
  ApiClientError,
  messagesApi,
  type Conversation,
} from "@/services/api";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

export interface UseMyConversationsOptions {
  /** Items per page. Defaults to 50 (mobile-friendly; web uses default). */
  perPage?: number;
  /** Logged-in user id — used to filter self-chats and identify match-request direction. */
  currentUserId: string | null;
  /** Fetch the archived list instead of the active inbox (WhatsApp-style). */
  archived?: boolean;
}

export interface UseMyConversationsResult {
  conversations: Conversation[];
  loading: boolean;
  error: ApiClientError | Error | null;
  /** True while a `markX` mutation is in flight; UI updates optimistically anyway. */
  mutating: boolean;
  refetch: () => Promise<void>;
  /** Optimistically accept an incoming match request. */
  /** Accept/request a match for ONE delivery. `deal` names which — omit it only when
   *  the pair have a single delivery in common, or the server refuses (MATCH_AMBIGUOUS). */
  acceptMatch: (
    conversationId: string,
    deal?: { parcel_id?: string; trip_id?: string },
  ) => Promise<void>;
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
  archived = false,
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
        const res = await messagesApi.listConversations({ page: 1, per_page: perPage, archived });
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
  }, [perPage, archived]);

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

  /**
   * Merge the server's returned row over the cached one.
   *
   * ⚠️ MERGE, never replace. `/match`, `/decline` and `/unmatch` return the bare
   * `conversations` row — no `participant`, no `unread_count`, because those are
   * assembled by the LIST endpoint. Replacing the row therefore dropped the
   * counterpart off it, and since the dedupe above keys on `participant.id`, the
   * conversation then vanished from the list entirely: the chat lost its header
   * name and its match banner until a full refetch happened to arrive.
   */
  const mergeServerRow = useCallback(
    (id: string, row: Conversation | undefined) => {
      if (!row) return;
      patch(id, (c) => ({ ...c, ...row }));
    },
    [patch],
  );

  /**
   * Wake every screen the handshake moves — the pinned workflow bar
   * (`useActiveDeal`), the inbox, My Travels — instead of waiting for the
   * realtime round-trip to come back to us. Same idiom as `useTravelDoc` /
   * `useParcelReview`. `listings` covers the parcel/trip/booking statuses a
   * confirmed match flips (web does the same via `invalidateDealCaches`).
   */
  const bumpHandshakeTopics = useCallback((listings: boolean) => {
    for (const t of ["conversations", "messages", "carrier-requests"] as const) bumpRealtimeTopic(t);
    if (!listings) return;
    for (const t of ["parcels", "trips", "bookings", "buddies"] as const) bumpRealtimeTopic(t);
  }, []);

  /**
   * Re-read the list from the server and report whether the row now reads the
   * way the caller's action wanted it to.
   *
   * A repeat press lands on a handshake that has already moved and the server
   * correctly refuses it with a 409 ("You already requested a match", "Cannot
   * decline: status is already 'declined'") — telling the user their action
   * failed when it demonstrably worked. ⚠️ But 409 is NOT benign by itself:
   * `/match` also returns it for the blockers the server was taught to REPORT
   * rather than hide (parcel already handed to another carrier, trip marked
   * unavailable). So the call is made on STATE, never on the error code alone.
   */
  const resyncSatisfies = useCallback(
    async (conversationId: string, satisfied: (c: Conversation) => boolean) => {
      try {
        const res = await messagesApi.listConversations({ page: 1, per_page: perPage, archived });
        const rows = res.data ?? [];
        if (mountedRef.current) setRawConversations(rows);
        const row = rows.find((c) => c.id === conversationId);
        return !!row && satisfied(row);
      } catch {
        return false;
      }
    },
    [perPage, archived],
  );

  /**
   * Accept (or request) a match for ONE delivery.
   *
   * `deal` names the parcel/trip the user acted on. A pair can have several deliveries
   * in common, and without a name the server refuses with MATCH_AMBIGUOUS rather than
   * picking one — that error is rethrown so the caller can show the picker.
   */
  const acceptMatch = useCallback(
    async (conversationId: string, deal?: { parcel_id?: string; trip_id?: string }) => {
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
        const res = await messagesApi.matchConversation(conversationId, deal);
        if (mountedRef.current) mergeServerRow(conversationId, res.data);
        bumpHandshakeTopics(true);
      } catch (err) {
        if (mountedRef.current) {
          // The server refused to choose between several deliveries. Nothing happened,
          // so undo the optimistic row and let the caller ask which one they meant.
          if (err instanceof ApiClientError && err.code === "MATCH_AMBIGUOUS") {
            if (snapshot) setRawConversations(snapshot);
            throw err;
          }
          // Already accepted (a double press, or the other side got there
          // first)? Then the action DID happen — resync and stay quiet.
          const settled =
            err instanceof ApiClientError &&
            err.code === "CONFLICT" &&
            (await resyncSatisfies(
              conversationId,
              (c) =>
                c.match_status === "matched" ||
                (!!currentUserId && c.matched_by === currentUserId),
            ));
          if (settled) {
            bumpHandshakeTopics(true);
            return;
          }
          if (snapshot) setRawConversations(snapshot);
          // Resync if a guard rejected because the other side acted first.
          void refetch();
        }
        throw err;
      } finally {
        if (mountedRef.current) setMutating(false);
      }
    },
    [mergeServerRow, currentUserId, refetch, resyncSatisfies, bumpHandshakeTopics],
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
        if (mountedRef.current) mergeServerRow(conversationId, res.data);
        // No listing statuses move on a decline — only the thread and the inbox.
        bumpHandshakeTopics(false);
      } catch (err) {
        if (mountedRef.current) {
          const settled =
            err instanceof ApiClientError &&
            err.code === "CONFLICT" &&
            (await resyncSatisfies(conversationId, (c) => c.match_status === "declined"));
          if (settled) {
            bumpHandshakeTopics(false);
            return;
          }
          if (snapshot) setRawConversations(snapshot);
          // Decline only works from `pending`; resync if the state moved.
          void refetch();
        }
        throw err;
      } finally {
        if (mountedRef.current) setMutating(false);
      }
    },
    [mergeServerRow, refetch, resyncSatisfies, bumpHandshakeTopics],
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
