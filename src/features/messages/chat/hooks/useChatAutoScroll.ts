import { useEffect, useRef } from "react";
import { type FlatList } from "react-native";

import { type DisplayMessage } from "@/hooks/api/useChatMessages";

/**
 * Owns the message list's ref and keeps the thread pinned to the newest message
 * as new ones arrive (but not when older history is prepended).
 */
export function useChatAutoScroll({
  messages,
  conversationId,
}: {
  messages: DisplayMessage[];
  conversationId: string | null;
}) {
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  // Track newest message timestamp seen so we only auto-scroll on new arrivals,
  // not on `loadOlder()` which prepends older rows. Web does the same via
  // `latestCreatedAtRef` (CustomerMessages.tsx:181-194).
  const latestSeenRef = useRef<number>(0);

  // Auto-scroll to bottom only when a NEWER message lands (not on prepend).
  // Without this, `loadOlder()` would yank the user back to the bottom every
  // time they tried to scroll up for history. Web parity:
  // CustomerMessages.tsx:181-194.
  useEffect(() => {
    if (messages.length === 0) return;
    const last = messages[messages.length - 1];
    if (!last) return;
    const ts = new Date(last.created_at).getTime();
    if (Number.isNaN(ts)) return;
    if (ts <= latestSeenRef.current) return;
    const isFirstPaint = latestSeenRef.current === 0;
    latestSeenRef.current = ts;
    requestAnimationFrame(() =>
      flatListRef.current?.scrollToEnd({ animated: !isFirstPaint }),
    );
  }, [messages]);

  // Reset the "newest seen" cursor when switching conversations so the next
  // open auto-scrolls to bottom instead of treating an older thread's last
  // message as already seen.
  useEffect(() => {
    latestSeenRef.current = 0;
  }, [conversationId]);

  return flatListRef;
}
