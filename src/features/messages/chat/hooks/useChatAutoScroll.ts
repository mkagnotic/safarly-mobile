import { useEffect, useRef } from "react";
import { type FlatList } from "react-native";

import { type DisplayMessage } from "@/hooks/api/useChatMessages";

/**
 * Owns the message list's ref and brings the newest message into view as new
 * ones arrive (but not when older history is prepended).
 *
 * ⚠️ The list is INVERTED (see ChatMessageList): offset 0 IS the newest message.
 * Opening a chat used to scrollToEnd once, a frame after the messages arrived —
 * then rows measured taller than estimated, attachment images loaded, and the
 * deal switcher + pinned step appeared and shrank the viewport, leaving the view
 * mid-thread. On a 667pt iPhone 8 the newest messages were off screen and the
 * chat read as "messages not loading" (client, 23 Oct 2026); following each
 * layout change still settled mid-thread in 3 of 5 emulator runs. An inverted
 * list starts at the newest message by construction and stays anchored to it
 * whatever above it changes size — no scrolling on open at all.
 */
export function useChatAutoScroll({
  messages,
  conversationId,
}: {
  messages: DisplayMessage[];
  conversationId: string | null;
}) {
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  // Track newest message timestamp seen so we only scroll on new arrivals, not
  // on `loadOlder()` which prepends older rows. Web does the same via
  // `latestCreatedAtRef` (CustomerMessages.tsx:181-194).
  const latestSeenRef = useRef<number>(0);

  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    const ts = new Date(last.created_at).getTime();
    if (Number.isNaN(ts)) return;
    if (ts <= latestSeenRef.current) return;
    const isFirstPaint = latestSeenRef.current === 0;
    latestSeenRef.current = ts;
    // The first paint is already at the newest message (inverted list).
    if (isFirstPaint) return;
    requestAnimationFrame(() =>
      flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
    );
  }, [messages]);

  // Reset the "newest seen" cursor when switching conversations.
  useEffect(() => {
    latestSeenRef.current = 0;
  }, [conversationId]);

  return flatListRef;
}
