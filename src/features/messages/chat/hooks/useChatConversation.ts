import { useEffect, useMemo, useState } from "react";

import { useMyConversations } from "@/hooks/api/useMyConversations";
import { messagesApi, type Conversation } from "@/services/api";

import { getInitials } from "../chatHelpers";
import { type ChatUser } from "../chatTypes";

/** The conversation on screen (from the inbox list) and the person on the other side. */
export function useChatConversation({
  conversationId,
  fallbackName,
  user,
}: {
  conversationId: string | null;
  fallbackName: string;
  user: ChatUser;
}) {
  const {
    conversations,
    acceptMatch,
    declineMatch,
    refetch: refetchConversations,
  } = useMyConversations({
    currentUserId: user?.id ?? null,
  });
  const listed = useMemo<Conversation | null>(
    () => (conversationId ? conversations.find((c) => c.id === conversationId) ?? null : null),
    [conversationId, conversations],
  );
  // The inbox pages 50 at a time, so a chat opened by link or notification may
  // not be on a loaded page - fetch that one conversation instead of showing a
  // nameless thread without its match actions.
  const [fetched, setFetched] = useState<Conversation | null>(null);
  // Keyed on WHETHER the list has it, not the list object - inbox refreshes
  // must not refetch it.
  const isListed = listed !== null;
  useEffect(() => {
    setFetched(null);
    if (!conversationId || isListed) return;
    let alive = true;
    messagesApi
      .getConversation(conversationId)
      .then((c) => {
        if (alive) setFetched(c);
      })
      .catch(() => {
        /* the fallback name still shows; the list may catch up */
      });
    return () => {
      alive = false;
    };
  }, [conversationId, isListed]);
  const conversation = listed ?? (fetched?.id === conversationId ? fetched : null);

  const participantName = conversation?.participant?.name ?? fallbackName;
  const participantInitials = getInitials(participantName);
  const participantId = conversation?.participant?.id ?? null;
  const participantAvatarUrl = conversation?.participant?.avatar_url ?? null;

  return {
    conversation,
    acceptMatch,
    declineMatch,
    refetchConversations,
    participantName,
    participantInitials,
    participantId,
    participantAvatarUrl,
  };
}
