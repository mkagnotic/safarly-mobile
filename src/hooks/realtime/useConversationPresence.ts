import { useCallback, useEffect, useRef, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { watchPresence } from "@/lib/presenceRegistry";

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

  // Participant presence — through the shared registry rather than opening a
  // channel directly. A React effect tears down and re-subscribes in the same tick
  // (participant id arriving late, switching chats, a remount) while
  // `removeChannel` is still async, so the re-join was refused and `online` stuck
  // at false: "offline" for someone demonstrably online.
  //
  // ⚠️ `selfKey` is MY id, not the id being watched — a presence key identifies the
  // client that is tracking, never its subject.
  useEffect(() => {
    const me = user?.id;
    if (!participantId || !me) return;

    const unwatch = watchPresence(`presence:user:${participantId}`, me, (keys) => {
      // Only THIS participant counts — watchers share the topic.
      setOnline(keys.includes(participantId));
    });

    return () => {
      unwatch();
      setOnline(false);
    };
  }, [participantId, user?.id]);

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
