import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { supabase } from "@/integrations/supabase/client";
import {
  ApiClientError,
  messagesApi,
  type Message,
  type RNUploadFile,
} from "@/services/api";

/** Local-only marker for messages that haven't reached the server yet. */
export type ClientStatus = "pending" | "failed";

export interface DisplayMessage extends Message {
  /** When set, this row originated locally (not yet confirmed by the server). */
  _clientStatus?: ClientStatus;
  /** Stable client id used to dedupe pending vs server echo. */
  _clientId?: string;
}

interface PendingMessage {
  clientId: string;
  text: string;
  attachment_url: string | null;
  attachment_type: string | null;
  created_at: string;
  status: ClientStatus;
}

export interface UseChatMessagesOptions {
  conversationId: string | null;
  /** Logged-in user id — needed to mark messages as "mine" and dedupe pending vs server. */
  currentUserId: string | null;
  /** Initial page size. Defaults to 50. */
  pageSize?: number;
}

export interface SendInput {
  text: string;
  /** Optional native-shaped file blob; if present, uploaded before the message is sent. */
  file?: RNUploadFile | null;
}

export interface UseChatMessagesResult {
  messages: DisplayMessage[];
  loading: boolean;
  loadingOlder: boolean;
  /** True when more messages exist before the current first row. */
  hasMore: boolean;
  error: ApiClientError | Error | null;
  /** True while a `send` is uploading the attachment. */
  uploading: boolean;
  /** Reload from page 1 (for pull-to-refresh / focus). */
  refetch: () => Promise<void>;
  /** Fetch the next older page (for infinite scroll up). */
  loadOlder: () => Promise<void>;
  /** Send text + optional attachment. Optimistic; failure flips the row to status="failed". */
  send: (input: SendInput) => Promise<void>;
  /** Re-attempt a failed pending message in place. */
  retry: (clientId: string) => Promise<void>;
  /** Drop a failed pending message. */
  discard: (clientId: string) => void;
}

/**
 * Loads + caches a single conversation's messages, with:
 *   - Realtime: subscribes to `messages` table INSERTs (new incoming) and
 *     UPDATEs (read receipts) for this conversation. No more pull-to-refresh
 *     to see the other side's latest message.
 *   - Optimistic send: a `pending` row appears immediately; the dedupe drops
 *     it when the server echo arrives via either refetch or the realtime
 *     INSERT event.
 *   - Infinite scroll: `loadOlder()` fetches the next page using the oldest
 *     message's `created_at` as the `before` cursor, prepending the result.
 */
export function useChatMessages({
  conversationId,
  currentUserId,
  pageSize = 50,
}: UseChatMessagesOptions): UseChatMessagesResult {
  const [serverMessages, setServerMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<PendingMessage[]>([]);
  const [loading, setLoading] = useState<boolean>(!!conversationId);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);
  const [uploading, setUploading] = useState(false);

  const mountedRef = useRef(true);
  const inFlightRef = useRef<Promise<void> | null>(null);
  const lastConvIdRef = useRef<string | null>(null);

  const refetch = useCallback(async () => {
    if (!conversationId) return;
    if (inFlightRef.current) return inFlightRef.current;
    const promise = (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await messagesApi.getMessages(conversationId, { limit: pageSize });
        if (!mountedRef.current) return;
        setServerMessages(res.data?.messages ?? []);
        setHasMore(!!res.data?.has_more);
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
  }, [conversationId, pageSize]);

  const loadOlder = useCallback(async () => {
    if (!conversationId || !hasMore || loadingOlder) return;
    // The oldest message's created_at is our cursor. Server returns messages
    // strictly older than this when `before` is supplied.
    const oldest = serverMessages.length > 0 ? serverMessages[0]?.created_at : undefined;
    if (!oldest) return;
    setLoadingOlder(true);
    try {
      const res = await messagesApi.getMessages(conversationId, {
        limit: pageSize,
        before: oldest,
      });
      if (!mountedRef.current) return;
      const olderBatch = res.data?.messages ?? [];
      // Prepend; dedupe by id in case of overlap.
      setServerMessages((prev) => {
        const seen = new Set(prev.map((m) => m.id));
        const merged = [...olderBatch.filter((m) => !seen.has(m.id)), ...prev];
        return merged;
      });
      setHasMore(!!res.data?.has_more);
    } catch (err) {
      if (mountedRef.current) {
        setError(err instanceof Error ? err : new Error(String(err)));
      }
    } finally {
      if (mountedRef.current) setLoadingOlder(false);
    }
  }, [conversationId, hasMore, loadingOlder, serverMessages, pageSize]);

  // Reload when conversation changes; clear local state so we don't flash old.
  useEffect(() => {
    mountedRef.current = true;
    if (lastConvIdRef.current !== conversationId) {
      lastConvIdRef.current = conversationId;
      setServerMessages([]);
      setPending([]);
      setError(null);
      setHasMore(false);
    }
    if (conversationId) {
      void refetch();
    } else {
      setLoading(false);
    }
    return () => {
      mountedRef.current = false;
    };
  }, [conversationId, refetch]);

  // ───────── Realtime subscription ─────────
  // Subscribe to INSERTs (new messages from the other side) and UPDATEs
  // (read_at changes for read receipts). Filter to our conversation only.
  useEffect(() => {
    if (!conversationId) return;
    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const incoming = payload.new as Partial<Message> | undefined;
          if (!incoming?.id) return;
          // Skip if we already have this row (e.g. our own send already echoed).
          setServerMessages((prev) => {
            if (prev.some((m) => m.id === incoming.id)) return prev;
            return [...prev, incoming as Message];
          });
        },
      )
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const updated = payload.new as Partial<Message> | undefined;
          if (!updated?.id) return;
          setServerMessages((prev) =>
            prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
          );
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversationId]);

  // Drop pending entries that now exist on the server (match by text + close created_at).
  useEffect(() => {
    if (pending.length === 0) return;
    const kept = pending.filter((p) => {
      if (p.status === "failed") return true;
      return !serverMessages.some(
        (s) =>
          (s.from_user_id === currentUserId || s.sender_id === currentUserId) &&
          (s.text === p.text || (!p.text && s.text === "📎 Attachment")) &&
          Math.abs(new Date(s.created_at).getTime() - new Date(p.created_at).getTime()) < 60_000,
      );
    });
    if (kept.length !== pending.length) setPending(kept);
  }, [serverMessages, pending, currentUserId]);

  const messages = useMemo<DisplayMessage[]>(() => {
    const pendingDisplay: DisplayMessage[] = pending.map((p) => ({
      id: p.clientId,
      conversation_id: conversationId ?? "",
      sender_id: currentUserId ?? "",
      from_user_id: currentUserId ?? "",
      text: p.text,
      created_at: p.created_at,
      attachment_url: p.attachment_url,
      attachment_type: p.attachment_type,
      delivered_at: null,
      read_at: null,
      _clientStatus: p.status,
      _clientId: p.clientId,
    }));
    const all: DisplayMessage[] = [...serverMessages, ...pendingDisplay];
    return all.sort(
      (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    );
  }, [serverMessages, pending, conversationId, currentUserId]);

  const send = useCallback(
    async ({ text, file }: SendInput) => {
      if (!conversationId) return;
      const trimmed = text.trim();
      if (!trimmed && !file) return;

      const clientId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const createdAt = new Date().toISOString();

      let attachment: { url: string; type: string } | undefined;

      if (file) {
        setUploading(true);
        const tempLabel = trimmed || "📎 Attachment";
        setPending((prev) => [
          ...prev,
          {
            clientId,
            text: tempLabel,
            attachment_url: null,
            attachment_type: file.type,
            created_at: createdAt,
            status: "pending",
          },
        ]);
        try {
          const result = await messagesApi.uploadAttachment(conversationId, file);
          // uploadAttachment already returns the unwrapped { url, path, type }.
          attachment = { url: result.url, type: result.type };
          setPending((prev) =>
            prev.map((p) =>
              p.clientId === clientId
                ? {
                    ...p,
                    attachment_url: attachment?.url ?? null,
                    attachment_type: attachment?.type ?? null,
                  }
                : p,
            ),
          );
        } catch (err) {
          if (mountedRef.current) {
            setPending((prev) =>
              prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed" } : p)),
            );
          }
          setUploading(false);
          throw err;
        }
        setUploading(false);
      } else {
        setPending((prev) => [
          ...prev,
          {
            clientId,
            text: trimmed,
            attachment_url: null,
            attachment_type: null,
            created_at: createdAt,
            status: "pending",
          },
        ]);
      }

      try {
        await messagesApi.sendMessage(conversationId, trimmed, attachment);
        // The realtime INSERT subscription will pick up the server echo
        // automatically; the dedupe effect drops the pending row.
      } catch (err) {
        if (mountedRef.current) {
          setPending((prev) =>
            prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed" } : p)),
          );
        }
        throw err;
      }
    },
    [conversationId],
  );

  const retry = useCallback(
    async (clientId: string) => {
      const item = pending.find((p) => p.clientId === clientId);
      if (!item || !conversationId) return;
      setPending((prev) =>
        prev.map((p) => (p.clientId === clientId ? { ...p, status: "pending" } : p)),
      );
      try {
        await messagesApi.sendMessage(
          conversationId,
          item.text === "📎 Attachment" ? "" : item.text,
          item.attachment_url && item.attachment_type
            ? { url: item.attachment_url, type: item.attachment_type }
            : undefined,
        );
      } catch (err) {
        if (mountedRef.current) {
          setPending((prev) =>
            prev.map((p) => (p.clientId === clientId ? { ...p, status: "failed" } : p)),
          );
        }
        throw err;
      }
    },
    [pending, conversationId],
  );

  const discard = useCallback((clientId: string) => {
    setPending((prev) => prev.filter((p) => p.clientId !== clientId));
  }, []);

  return {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    uploading,
    refetch,
    loadOlder,
    send,
    retry,
    discard,
  };
}
