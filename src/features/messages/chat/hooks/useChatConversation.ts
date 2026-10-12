import { useMemo } from "react";

import { useMyConversations } from "@/hooks/api/useMyConversations";
import { type Conversation } from "@/services/api";

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
  const conversation = useMemo<Conversation | null>(
    () => (conversationId ? conversations.find((c) => c.id === conversationId) ?? null : null),
    [conversationId, conversations],
  );

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
