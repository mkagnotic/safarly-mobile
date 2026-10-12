import { useCallback, useEffect, type RefObject } from "react";
import { type FlatList, type NativeScrollEvent, type NativeSyntheticEvent } from "react-native";

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
  // keyboard-driven resize settle before measuring.
  //
  // `flatListRef` is a stable ref object (see `useChatAutoScroll`), so listing it
  // changes nothing: the effect still runs only when `keyboardOpen` changes.
  useEffect(() => {
    if (!keyboardOpen) return;
    const timer = setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(timer);
  }, [keyboardOpen, flatListRef]);

  // Auto-load older messages when the user scrolls within 80px of the top —
  // matches web (CustomerMessages.tsx:232-239). Manual button stays as a
  // visible affordance for users who don't realize the scroll trigger exists.
  const handleListScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (!hasMore || loadingOlder) return;
      if (event.nativeEvent.contentOffset.y > 80) return;
      void loadOlder();
    },
    [hasMore, loadingOlder, loadOlder],
  );

  return { handleListScroll };
}
