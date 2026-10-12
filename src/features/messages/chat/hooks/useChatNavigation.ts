import { useCallback } from "react";
import { useFocusEffect } from "@react-navigation/native";
import { BackHandler } from "react-native";

import { setActiveConversation } from "@/store/activeConversation";

import { type getBackTarget } from "../chatHelpers";
import { type ChatNav } from "../chatTypes";

interface UseChatNavigationInput {
  navigation: ChatNav;
  fallbackBackTarget: ReturnType<typeof getBackTarget>;
  conversationId: string | null;
  participantId: string | null;
  participantName: string;
}

/**
 * Leaving the chat (header back + Android hardware back), opening the other
 * user's profile, and marking this conversation as the one on screen.
 */
export function useChatNavigation({
  navigation,
  fallbackBackTarget,
  conversationId,
  participantId,
  participantName,
}: UseChatNavigationInput) {
  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate(fallbackBackTarget);
  }, [navigation, fallbackBackTarget]);

  // Tapping the header avatar / name opens the other user's public profile —
  // web parity (`CustomerMessages.tsx` navigates to `/customer/profile/:id`).
  // No-ops until the conversation (and thus the participant id) has loaded.
  const handleOpenProfile = useCallback(() => {
    if (!participantId) return;
    navigation.navigate("PublicProfileTab", { userId: participantId, name: participantName });
  }, [navigation, participantId, participantName]);

  // Hardware back button on Android.
  useFocusEffect(
    useCallback(() => {
      const sub = BackHandler.addEventListener("hardwareBackPress", () => {
        goBack();
        return true;
      });
      return () => sub.remove();
    }, [goBack]),
  );

  // Mark this conversation as the one on screen so the realtime sync suppresses
  // the in-app new-message toast for it (standard chat behaviour — no banner for
  // the thread you're already reading). Cleared on blur / switching threads.
  useFocusEffect(
    useCallback(() => {
      setActiveConversation(conversationId);
      return () => setActiveConversation(null);
    }, [conversationId]),
  );

  return { goBack, handleOpenProfile };
}
