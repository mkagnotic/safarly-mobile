import { useCallback } from "react";
import { type ListRenderItemInfo } from "react-native";

import { type OfferRenderState, type ResolvedOffers } from "@/features/messages/offerResolution";
import { type DisplayMessage, type UseChatMessagesResult } from "@/hooks/api/useChatMessages";
import { type UseOffersResult } from "@/hooks/api/useOffers";

import { MessageBubble } from "../bubbles/MessageBubble";
import { type ChatNav, type ChatUser } from "../chatTypes";

interface UseChatMessageRendererInput {
  user: ChatUser;
  navigation: ChatNav;
  retry: UseChatMessagesResult["retry"];
  discard: UseChatMessagesResult["discard"];
  offerState: ResolvedOffers;
  supportsOffers: boolean;
  offerPending: UseOffersResult["pending"];
  handleBubbleLongPress: (message: DisplayMessage) => void;
  handleAcceptOffer: (offerId: string) => Promise<void>;
  handleDeclineOffer: (offerId: string) => Promise<void>;
  handleOpenOfferComposer: () => void;
  setExpandedImageUrl: (url: string | null) => void;
}

/** `renderItem` / `keyExtractor` for the message list. */
export function useChatMessageRenderer({
  user,
  navigation,
  retry,
  discard,
  offerState,
  supportsOffers,
  offerPending,
  handleBubbleLongPress,
  handleAcceptOffer,
  handleDeclineOffer,
  handleOpenOfferComposer,
  setExpandedImageUrl,
}: UseChatMessageRendererInput) {
  const handleSystemPress = useCallback(
    (bookingId: string) => {
      navigation.navigate("BookingsTab", { expandId: bookingId });
    },
    [navigation],
  );

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<DisplayMessage>) => {
      const mine = item.sender_id === user?.id || item.from_user_id === user?.id;
      let offer: OfferRenderState | undefined;
      if ((item.message_kind ?? "text") === "offer_card") {
        const status = offerState.statusById.get(item.id) ?? "open";
        const live = offerState.live;
        const actionable = !!live && live.messageId === item.id && !mine && supportsOffers;
        offer = {
          status,
          currency: offerState.currencyById.get(item.id),
          actions:
            actionable && live
              ? {
                  acceptPending: offerPending === `accept:${live.offerId}`,
                  rejectPending: offerPending === `reject:${live.offerId}`,
                  onAccept: () => void handleAcceptOffer(live.offerId),
                  onCounter: handleOpenOfferComposer,
                  onDecline: () => void handleDeclineOffer(live.offerId),
                }
              : undefined,
        };
      }
      return (
        <MessageBubble
          message={item}
          mine={mine}
          offer={offer}
          onRetry={() => void retry(item._clientId ?? item.id)}
          onDiscard={() => discard(item._clientId ?? item.id)}
          onOpenImage={(url) => setExpandedImageUrl(url)}
          onLongPress={handleBubbleLongPress}
          onSystemPress={handleSystemPress}
        />
      );
    },
    [
      user?.id,
      retry,
      discard,
      handleBubbleLongPress,
      offerState,
      supportsOffers,
      offerPending,
      handleAcceptOffer,
      handleDeclineOffer,
      handleOpenOfferComposer,
      handleSystemPress,
      setExpandedImageUrl,
    ],
  );

  const keyExtractor = useCallback((item: DisplayMessage) => item.id, []);

  return { renderMessage, keyExtractor };
}
