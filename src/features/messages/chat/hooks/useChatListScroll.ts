import { useCallback, useEffect, type RefObject } from "react";
import { type FlatList } from "react-native";

import { type DisplayMessage, type UseChatMessagesResult } from "@/hooks/api/useChatMessages";

interface UseChatListScrollInput {
  flatListRef: RefObject<FlatList<DisplayMessage> | null>;
  keyboardOpen: boolean;
  hasMore: UseChatMessagesResult["hasMore"];
  loadingOlder: UseChatMessagesResult["loadingOlder"];
  loadOlder: UseChatMessagesResult["loadOlder"];
}

/** Follows the newest message when the keyboard opens, and loads history near the top. */
export function useChatListScroll({
  flatListRef,
  keyboardOpen,
  hasMore,
  loadingOlder,
  loadOlder,
}: UseChatListScrollInput) {
  // Follow to the newest message when the keyboard opens. Without this the
  // thread just gets shorter and you're left reading older messages while
  // typing — every messaging app scrolls down here. The delay lets the
  // keyboard-driven resize settle before measuring. The list is inverted, so
  // the newest message is offset 0.
  //
  // `flatListRef` is a stable ref object (see `useChatAutoScroll`), so listing it
  // changes nothing: the effect still runs only when `keyboardOpen` changes.
  useEffect(() => {
    if (!keyboardOpen) return;
    const timer = setTimeout(
      () => flatListRef.current?.scrollToOffset({ offset: 0, animated: true }),
      80,
    );
    return () => clearTimeout(timer);
  }, [keyboardOpen, flatListRef]);

  // Auto-load older messages near the top of the thread — WhatsApp-style, web
  // parity (CustomerMessages.tsx:232-239). In the inverted list the oldest
  // message is the list's END, so this is `onEndReached`; prepended history
  // lands above the view without moving it.
  const handleReachOldest = useCallback(() => {
    if (!hasMore || loadingOlder) return;
    void loadOlder();
  }, [hasMore, loadingOlder, loadOlder]);

  return { handleReachOldest };
}
