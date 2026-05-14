import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

interface BroadcastFromPayload {
  from?: string;
}

/**
 * Tracks online + typing state for the OTHER participant in a 1-on-1 chat.
 *
 *   - `online` — subscribes to `presence:user:{participantId}` and mirrors their
 *     Realtime Presence state. Requires the other user to be running
 *     `usePresenceBroadcast()` near their app root.
 *   - `typing` — receives typing broadcasts on `conv-typing:{conversationId}`.
 *     Auto-clears after 2.5s of silence.
 *   - `notifyTyping()` — call on every keystroke; throttled to one outgoing
 *     `typing` broadcast per 2s, plus a `stop_typing` 2.5s after the last call.
 *   - `stopTyping()` — call on send / blur to clear the indicator immediately.
 *
 * Web parity (`hooks/useConversationPresence.ts`). The only RN-specific change
 * is swapping `window.setTimeout` for the global `setTimeout` (which on RN
 * returns a `Timeout` object, not a number — we type it accordingly).
 */
export function useConversationPresence(
  conversationId: string | null,
  participantId: string | null | undefined,
) {
  const { user } = useAuth();
  const [online, setOnline] = useState(false);
  const [typing, setTyping] = useState(false);

  const convChannelRef = useRef<RealtimeChannel | null>(null);
  const incomingTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const outgoingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentAt = useRef<number>(0);

  // Participant presence — open one channel per participant. Don't mix with the
  // conversation channel: presence keys collide if two participants share one.
  useEffect(() => {
    if (!participantId) return;
    const channel = supabase.channel(`presence:user:${participantId}`, {
      config: { presence: { key: participantId } },
    });
    channel
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState();
        setOnline(Object.keys(state).length > 0);
      })
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
      setOnline(false);
    };
  }, [participantId]);

  // Conversation-scoped typing channel — independent of the messages-table
  // postgres_changes channel in `useChatMessages`, so realtime stays decoupled.
  useEffect(() => {
    if (!conversationId || !user?.id) return;
    const uid = user.id;
    const channel = supabase.channel(`conv-typing:${conversationId}`);

    channel
      .on("broadcast", { event: "typing" }, (payload) => {
        const from = (payload.payload as BroadcastFromPayload | undefined)?.from;
        if (!from || from === uid) return;
        setTyping(true);
        if (incomingTypingTimer.current) clearTimeout(incomingTypingTimer.current);
        incomingTypingTimer.current = setTimeout(() => setTyping(false), 2500);
      })
      .on("broadcast", { event: "stop_typing" }, (payload) => {
        const from = (payload.payload as BroadcastFromPayload | undefined)?.from;
        if (!from || from === uid) return;
        setTyping(false);
        if (incomingTypingTimer.current) clearTimeout(incomingTypingTimer.current);
      })
      .subscribe();

    convChannelRef.current = channel;

    return () => {
      void supabase.removeChannel(channel);
      convChannelRef.current = null;
      setTyping(false);
      if (incomingTypingTimer.current) clearTimeout(incomingTypingTimer.current);
      if (outgoingStopTimer.current) clearTimeout(outgoingStopTimer.current);
      lastTypingSentAt.current = 0;
    };
  }, [conversationId, user?.id]);

  const notifyTyping = useCallback(() => {
    const channel = convChannelRef.current;
    const uid = user?.id;
    if (!channel || !uid) return;

    const now = Date.now();
    if (now - lastTypingSentAt.current > 2000) {
      void channel.send({ type: "broadcast", event: "typing", payload: { from: uid } });
      lastTypingSentAt.current = now;
    }
    if (outgoingStopTimer.current) clearTimeout(outgoingStopTimer.current);
    outgoingStopTimer.current = setTimeout(() => {
      void channel.send({
        type: "broadcast",
        event: "stop_typing",
        payload: { from: uid },
      });
      lastTypingSentAt.current = 0;
    }, 2500);
  }, [user?.id]);

  const stopTyping = useCallback(() => {
    const channel = convChannelRef.current;
    const uid = user?.id;
    if (!channel || !uid) return;
    if (outgoingStopTimer.current) clearTimeout(outgoingStopTimer.current);
    if (lastTypingSentAt.current > 0) {
      void channel.send({
        type: "broadcast",
        event: "stop_typing",
        payload: { from: uid },
      });
      lastTypingSentAt.current = 0;
    }
  }, [user?.id]);

  return { online, typing, notifyTyping, stopTyping };
}
