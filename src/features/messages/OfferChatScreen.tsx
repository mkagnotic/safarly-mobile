import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useModalHandoff } from "@/hooks/useModalHandoff";
import { StyleSheet, Text, View } from "react-native";
import EmojiPicker from "rn-emoji-keyboard";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { DeclineMatchModal } from "@/components/chat/DeclineMatchModal";
import { OfferComposerModal } from "@/components/chat/OfferComposerModal";
import { ParcelReviewModal } from "@/components/chat/ParcelReviewModal";
import { PayoutRequiredModal } from "@/components/chat/PayoutRequiredModal";
import { TravelDocModal } from "@/components/chat/TravelDocModal";
import { ChatDealSwitcher } from "@/features/messages/ChatDealSwitcher";
import { labelDeals, selectableDeals } from "@/utils/dealLabel";
import { ChatWorkflowPin } from "@/features/messages/ChatWorkflowPin";
import { useAuth } from "@/context/AuthContext";
import { useActiveDeal } from "@/hooks/api/useActiveDeal";
import { useChatMessages } from "@/hooks/api/useChatMessages";
import { useOffers } from "@/hooks/api/useOffers";
import { resolveOffers } from "@/features/messages/offerResolution";
import { useConversationPresence } from "@/hooks/realtime/useConversationPresence";
import { messagesApi } from "@/services/api";
import { colors } from "@/theme/colors";
import { currencySymbol } from "@/utils/money";

import { getBackTarget } from "./chat/chatHelpers";
import { chatStyles } from "./chat/chatStyles";
import { type ChatNav, type ChatRoute } from "./chat/chatTypes";
import { AttachSheet } from "./chat/components/AttachSheet";
import { BubbleMenuSheet } from "./chat/components/BubbleMenuSheet";
import { ChatActionsSheet } from "./chat/components/ChatActionsSheet";
import { ChatComposer } from "./chat/components/ChatComposer";
import { ChatHeader } from "./chat/components/ChatHeader";
import { ChatMatchModals } from "./chat/components/ChatMatchModals";
import { ChatMessageList } from "./chat/components/ChatMessageList";
import { ChatModerationModals } from "./chat/components/ChatModerationModals";
import { ImagePreviewModal } from "./chat/components/ImagePreviewModal";
import { MatchStateBanner } from "./chat/components/MatchStateBanner";
import { OfferBar } from "./chat/components/OfferBar";
import { useChatActionMenu } from "./chat/hooks/useChatActionMenu";
import { useChatAutoScroll } from "./chat/hooks/useChatAutoScroll";
import { useChatBubbleMenu } from "./chat/hooks/useChatBubbleMenu";
import { useChatComposer } from "./chat/hooks/useChatComposer";
import { useChatConversation } from "./chat/hooks/useChatConversation";
import { useChatKeyboardLayout } from "./chat/hooks/useChatKeyboardLayout";
import { useChatListScroll } from "./chat/hooks/useChatListScroll";
import { useChatMatchActions } from "./chat/hooks/useChatMatchActions";
import { useChatMatchStatus } from "./chat/hooks/useChatMatchStatus";
import { useChatMessageRenderer } from "./chat/hooks/useChatMessageRenderer";
import { useChatModalError, useClearModalErrorOnClose } from "./chat/hooks/useChatModalError";
import { useChatNavigation } from "./chat/hooks/useChatNavigation";
import { useChatOfferActions } from "./chat/hooks/useChatOfferActions";
import { useChatPinAction } from "./chat/hooks/useChatPinAction";
import { useChatVerification } from "./chat/hooks/useChatVerification";

export function OfferChatScreen() {
  const navigation = useNavigation<ChatNav>();
  const route = useRoute<ChatRoute>();
  const { user } = useAuth();
  // The conversation hides the tab bar (FULLSCREEN_TAB), so the composer is now
  // the bottom-most element and has to clear the gesture bar itself.
  const insets = useSafeAreaInsets();
  // Bottom sheets clear the iPhone home indicator.
  const sheetInset = { paddingBottom: Math.max(insets.bottom, 16) + 8 };
  // Keyboard lift for the container and the composer — see `useChatKeyboardLayout`.
  const { keyboardOpen, composerBottomPad, onContainerLayout, containerKeyboardPad } =
    useChatKeyboardLayout(insets);

  const conversationId = route.params?.conversationId ?? null;
  const fallbackName = route.params?.name ?? "Conversation";
  const source = route.params?.source ?? "messages";
  const fallbackBackTarget = getBackTarget(source);

  const {
    conversation, acceptMatch, declineMatch, refetchConversations,
    participantName, participantInitials, participantId, participantAvatarUrl,
  } = useChatConversation({ conversationId, fallbackName, user });
  // ───────── Server-owned workflow (pinned action bar) ─────────
  const {
    activeDeal, workflow, deals, selectedDealId, selectDeal, refetch: refetchActiveDeal,
  } = useActiveDeal(conversationId);

  // Header badge, match banner and match-action subject — see `useChatMatchStatus`.
  const {
    matchStatus, matchableDeal, isBlocked, matchedByOther, matchedByMe, wasUnmatched, isDeclined,
    canSend, userRole, isMatched, matchBannerVisible,
  } = useChatMatchStatus({ conversation, conversationId, activeDeal, workflow, user });

  const {
    messages, loading, loadingOlder, hasMore, error, uploading, refetch, loadOlder, send, retry,
    discard,
  } = useChatMessages({ conversationId, currentUserId: user?.id ?? null });

  // Realtime presence + typing for the OTHER side. Auto-no-ops until we know
  // both ids — `participantId` lands once `useMyConversations` returns.
  const { online, typing, notifyTyping, stopTyping } = useConversationPresence(
    conversationId,
    participantId,
  );

  // ───────── In-chat offers ─────────
  const { pending: offerPending, seedOffer, postOffer, acceptOffer, rejectOffer } =
    useOffers(conversationId);
  const offerState = useMemo(
    () => resolveOffers(messages, user?.id ?? null),
    [messages, user?.id],
  );
  /**
   * Offers this screen has already settled, kept until the server's own
   * `offer_accept` / `offer_reject` message lands.
   *
   * `resolveOffers` derives the live offer from the MESSAGE THREAD, so the bar keeps
   * offering "Accept / Counter / Decline" until the refreshed messages arrive — beside
   * the thread's own "match confirmed" line. The buttons are locked while the request
   * runs, but a live-looking decision row for a decision already taken reads as "it
   * didn't work", and the obvious response is to press it again.
   *
   * Web solves the same window by settling its cached `activeDeal.offer`
   * (`settleCachedOffer` in `hooks/api/useMessages.ts`); mobile has no such cache, so
   * it holds the ids locally. No cleanup needed — once the real message arrives the
   * resolver returns null on its own.
   */
  const [settledOfferIds, setSettledOfferIds] = useState<string[]>([]);
  const markOfferSettled = useCallback((offerId: string) => {
    setSettledOfferIds((prev) => (prev.includes(offerId) ? prev : [...prev, offerId]));
  }, []);

  /**
   * Which delivery is the pinned action about?
   *
   * ⚠️ The pinned prompts are deal-scoped but named none of them. With two deliveries
   * in one thread - and the pair CAN hold opposite roles in each - "Upload your travel
   * document" read as being about the OTHER delivery, and was reported as the app
   * asking the wrong person. It was asking correctly; nothing on screen said which
   * deal it meant. Only shown for a thread with more than one, so the ordinary
   * single-delivery chat is untouched. See `utils/dealLabel.ts`.
   */
  // ⚠️ Gated on the SELECTABLE deals, exactly as the switcher is - see web.
  const selectedDealLabel = useMemo(() => {
    if (selectableDeals(deals ?? [], selectedDealId).length < 2) return null;
    return labelDeals(deals ?? []).get(selectedDealId ?? "") ?? null;
  }, [deals, selectedDealId]);

  const liveOffer = useMemo(() => {
    const live = offerState.live;
    return live && settledOfferIds.includes(live.offerId) ? null : live;
  }, [offerState.live, settledOfferIds]);

  // The pin defers to the match banner and the live-offer bar only while that UI
  // is actually on screen — see `matchBannerVisible` in `useChatMatchStatus`.
  const showWorkflowPin = useMemo(() => {
    if (!workflow) return false;
    if (workflow.state === "MATCHED") return false; // nothing to prompt between stages
    if (workflow.state === "PRICE_OFFER" && liveOffer) return false; // offer bar owns it
    const isMatchState = (
      ["NEGOTIATING", "MATCH_REQUESTED", "MATCH_DECLINED", "BLOCKED"] as const
    ).includes(workflow.state as never);
    if (isMatchState && matchBannerVisible) return false; // banner owns it
    return true;
  }, [workflow, liveOffer, matchBannerVisible]);
  // Delivery offers only exist in a booking context, never for buddy matches.
  const supportsOffers = isMatched && conversation?.context_type !== "buddy";
  const offerCurrencySymbol = currencySymbol(liveOffer?.currency);

  // Failures inside an open Modal are reported in that Modal — see `useChatModalError`.
  const { setModalError, errorFor } = useChatModalError();
  // iOS can't present a Modal (or a native picker) while another is still
  // fading out, so anything opened from a sheet waits for it to dismiss.
  const { after: afterChildModal } = useModalHandoff();

  // Composer + attach sheet + emoji picker.
  const composer = useChatComposer({ canSend, send, notifyTyping, stopTyping });
  const { emojiOpen, setEmojiOpen, setDraft } = composer;
  // Header kebab: conversation actions and the dialogs they open.
  const actionMenu = useChatActionMenu({
    conversationId, conversation, activeDeal, matchableDeal, navigation, refetchConversations,
    refetchActiveDeal, afterChildModal, setModalError,
  });
  const { setActionMenuOpen, reportUserOpen, confirmAction } = actionMenu;
  // Bubble long-press: copy / report.
  const bubbleActions = useChatBubbleMenu({ setModalError });
  const { reportTarget, handleBubbleLongPress } = bubbleActions;
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  // Match handshake.
  const match = useChatMatchActions({
    conversationId, conversation, user, matchableDeal, acceptMatch, declineMatch,
    refetchActiveDeal, afterChildModal, setModalError,
  });
  const {
    matchCandidates, declineOpen, setDeclineOpen, matchModalOpen, setMatchModalOpen, matchPending,
    decliningPending, matchBusy, handleAccept, handleDeclineConfirm,
  } = match;
  const {
    travelDocOpen, setTravelDocOpen, parcelReviewOpen, setParcelReviewOpen, travelDoc,
    parcelReview, handleDocUpload, handleDocApprove, handleDocReject, handleDocAdminReview,
    handleDocCancelMatch, handleParcelUpload, handleParcelApprove, handleParcelReject,
    handleParcelCancel,
  } = useChatVerification({
    activeDeal, workflow, refetchActiveDeal, refetchConversations, setModalError,
  });
  const {
    offerComposer, setOfferComposer, offerBanner, setOfferBanner, payoutRequiredOpen,
    setPayoutRequiredOpen, handleOpenOfferComposer, handleSubmitOffer, handleAcceptOffer,
    handleDeclineOffer,
  } = useChatOfferActions({
    liveOffer, activeDeal, user, navigation, participantName, seedOffer, postOffer, acceptOffer,
    rejectOffer, markOfferSettled, setActionMenuOpen,
  });

  const { goBack, handleOpenProfile } = useChatNavigation({
    navigation, fallbackBackTarget, conversationId, participantId, participantName,
  });

  const flatListRef = useChatAutoScroll({ messages, conversationId });

  // A chat opened straight from Search/Matches was just created, so it isn't in
  // the conversations list yet — leaving the header name/avatar, presence and
  // the match banner unhydrated. Pull the list once when we're on a conversation
  // that isn't present so those fill in. (The workflow pin already renders the
  // right state meanwhile, since it fetches by id.)
  useEffect(() => {
    if (conversationId && !conversation) void refetchConversations();
  }, [conversationId, conversation, refetchConversations]);

  const { handleListScroll } = useChatListScroll({
    flatListRef, keyboardOpen, hasMore, loadingOlder, loadOlder,
  });

  // Mark incoming messages as delivered when the screen mounts with a real conversation.
  useEffect(() => {
    if (!conversationId) return;
    void messagesApi.markDelivered(conversationId).catch(() => {
      /* fire-and-forget — ignore failures */
    });
  }, [conversationId]);

  // Drop a Modal's error once that Modal closes, so it never reopens stale.
  useClearModalErrorOnClose(setModalError, {
    matchModalOpen, matchCandidates, declineOpen, confirmAction, reportTarget, reportUserOpen,
    travelDocOpen, parcelReviewOpen,
  });

  const handlePinAction = useChatPinAction({
    activeDeal, liveOffer, user, participantName, navigation, handleAccept, handleAcceptOffer,
    handleOpenOfferComposer, setMatchModalOpen, setTravelDocOpen, setParcelReviewOpen,
  });

  const { renderMessage, keyExtractor } = useChatMessageRenderer({
    user, navigation, retry, discard, offerState, supportsOffers, offerPending,
    handleBubbleLongPress, handleAcceptOffer, handleDeclineOffer, handleOpenOfferComposer,
    setExpandedImageUrl,
  });

  // ───────── No-conversation guard ─────────
  if (!conversationId) {
    return (
      <Screen
        scroll={false}
        edges={["top", "left", "right"]}
        safeBackgroundColor={colors.chatSurface}
      >
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>{participantName}</Text>
        </View>
        <View style={styles.centered}>
          <Ionicons name="chatbox-outline" size={36} color={colors.mutedText} />
          <Text style={styles.centeredTitle}>Open a conversation from your inbox</Text>
          <Text style={styles.centeredBody}>
            This screen needs a conversation id to load real messages.
          </Text>
        </View>
      </Screen>
    );
  }

  return (
    // Flat neutral surface rather than the app's hero gradient: bubbles are the
    // content here, and the peach/lavender wash competed with them.
    <Screen
      scroll={false}
      edges={["top", "left", "right"]}
      safeBackgroundColor={colors.chatSurface}
      disableKeyboardAvoiding
    >
      {/*
        Keyboard handling, WhatsApp-style: the composer sits flush on the
        keyboard with no gap.

        - iOS: the window is never resized for the keyboard, so the whole
          container is lifted by the real keyboard height.
        - Android: lifted by whatever part of the keyboard the OS did not
          already absorb by resizing — see `containerKeyboardPad`. That is zero
          where the window resizes and the full height on Android 15, where
          enforced edge-to-edge stops it resizing.

        `keyboardOpen` (from useKeyboardMetrics) still drives the
        composer's bottom padding and the scroll-to-newest on open.
      */}
      <View style={[styles.flex, { paddingBottom: containerKeyboardPad }]} onLayout={onContainerLayout}>
        {/* ───────── Header ───────── */}
        <ChatHeader
          goBack={goBack}
          handleOpenProfile={handleOpenProfile}
          setActionMenuOpen={setActionMenuOpen}
          participantId={participantId}
          participantName={participantName}
          participantInitials={participantInitials}
          participantAvatarUrl={participantAvatarUrl}
          matchStatus={matchStatus}
          isBlocked={isBlocked}
          matchedByOther={matchedByOther}
          matchedByMe={matchedByMe}
          isDeclined={isDeclined}
          typing={typing}
          online={online}
        />

        {/* ───────── Match-state banner ───────── */}
        <MatchStateBanner
          participantName={participantName}
          matchedByOther={matchedByOther}
          matchedByMe={matchedByMe}
          isDeclined={isDeclined}
          wasUnmatched={wasUnmatched}
          isBlocked={isBlocked}
          matchBusy={matchBusy}
          matchPending={matchPending}
          decliningPending={decliningPending}
          setMatchModalOpen={setMatchModalOpen}
          setDeclineOpen={setDeclineOpen}
        />

        {/* ───────── Offer action feedback ───────── */}
        {offerBanner ? (
          <View style={styles.offerBannerWrap}>
            <FormBanner
              variant={offerBanner.variant}
              title={offerBanner.title}
              message={offerBanner.message}
              onDismiss={() => setOfferBanner(null)}
            />
          </View>
        ) : null}

        {/* ───────── Messages list ───────── */}
        <ChatMessageList
          flatListRef={flatListRef}
          messages={messages}
          loading={loading}
          loadingOlder={loadingOlder}
          error={error}
          refetch={refetch}
          keyExtractor={keyExtractor}
          renderMessage={renderMessage}
          handleListScroll={handleListScroll}
        />

        {/* Only rendered when the thread actually holds more than one delivery. */}
        <ChatDealSwitcher deals={deals} selectedDealId={selectedDealId} onSelect={selectDeal} />

        {selectedDealLabel ? (
          <View style={styles.dealContext}>
            <Text style={styles.dealContextText}>
              This step is for <Text style={styles.dealContextName}>{selectedDealLabel.full}</Text>
            </Text>
          </View>
        ) : null}

        {/* ───────── Workflow pin (server FSM) ───────── */}
        {showWorkflowPin && workflow ? (
          <ChatWorkflowPin
            workflow={workflow}
            activeDeal={activeDeal}
            onAction={handlePinAction}
          />
        ) : null}

        {/* ───────── Offer bar ───────── */}
        {supportsOffers && liveOffer ? (
          <OfferBar
            liveOffer={liveOffer}
            participantName={participantName}
            offerPending={offerPending}
            handleAcceptOffer={handleAcceptOffer}
            handleDeclineOffer={handleDeclineOffer}
            handleOpenOfferComposer={handleOpenOfferComposer}
          />
        ) : null}

        {/* ───────── Composer ───────── */}
        {/*
          Always show the composer unless blocked — web parity
          (`CustomerMessages.tsx` only disables on `isBlocked`) and standard
          messaging-app behaviour. Previously `!matchedByOther` removed the whole
          input box for the person who RECEIVED a match request, leaving the
          screen with the Accept banner and empty dead space below it. The
          accept/decline banner now sits above a live composer instead.
        */}
        {canSend ? (
          <ChatComposer
            composer={composer}
            composerBottomPad={composerBottomPad}
            uploading={uploading}
            stopTyping={stopTyping}
          />
        ) : null}
      </View>

      <AttachSheet composer={composer} sheetInset={sheetInset} />

      <ChatActionsSheet
        actionMenu={actionMenu}
        sheetInset={sheetInset}
        matchStatus={matchStatus}
        matchedByOther={matchedByOther}
        isBlocked={isBlocked}
        setMatchModalOpen={setMatchModalOpen}
        setDeclineOpen={setDeclineOpen}
      />

      <BubbleMenuSheet bubbleActions={bubbleActions} sheetInset={sheetInset} />

      <ImagePreviewModal
        expandedImageUrl={expandedImageUrl}
        setExpandedImageUrl={setExpandedImageUrl}
        insets={insets}
      />

      {/* ───────── Decline-match modal ───────── */}
      <DeclineMatchModal
        open={declineOpen}
        participantName={participantName}
        pending={decliningPending}
        matchRequestFromOther={matchedByOther}
        error={errorFor("decline")}
        onCancel={() => {
          if (!decliningPending) setDeclineOpen(false);
        }}
        onConfirm={(reason) => void handleDeclineConfirm(reason)}
      />

      <ChatModerationModals
        actionMenu={actionMenu}
        bubbleActions={bubbleActions}
        conversationId={conversationId}
        participantName={participantName}
        errorFor={errorFor}
      />

      {/* ───────── Payout-required (carrier accept gate) ───────── */}
      <PayoutRequiredModal
        open={payoutRequiredOpen}
        onClose={() => setPayoutRequiredOpen(false)}
        onSetup={() => {
          setPayoutRequiredOpen(false);
          navigation.navigate("PayoutSetupTab");
        }}
      />

      <ChatMatchModals
        match={match}
        userRole={userRole}
        conversation={conversation}
        errorFor={errorFor}
      />

      {/* ───────── Travel-document verification modal ───────── */}
      <TravelDocModal
        open={travelDocOpen}
        doc={travelDoc.doc}
        loading={travelDoc.loading}
        pending={travelDoc.pending}
        onClose={() => setTravelDocOpen(false)}
        error={errorFor("travelDoc")}
        onDismissError={() => setModalError(null)}
        onUpload={(file) => void handleDocUpload(file)}
        onApprove={() => void handleDocApprove()}
        onReject={(reason) => void handleDocReject(reason)}
        onRequestAdminReview={() => void handleDocAdminReview()}
        onCancelMatch={() => void handleDocCancelMatch()}
      />

      {/* ───────── Parcel-photo review modal ───────── */}
      {/* `counterpartName` is the RAW name, not `participantName` - that falls back
          to the literal "Conversation", which would read "Awaiting Conversation's
          parcel photos". Absent means the card falls back to the role instead. */}
      <ParcelReviewModal
        open={parcelReviewOpen}
        review={parcelReview.review}
        loading={parcelReview.loading}
        pending={parcelReview.pending}
        onClose={() => setParcelReviewOpen(false)}
        error={errorFor("parcelReview")}
        onDismissError={() => setModalError(null)}
        onUpload={(files) => void handleParcelUpload(files)}
        onApprove={() => void handleParcelApprove()}
        onReject={(reason, note) => void handleParcelReject(reason, note)}
        onCancelRequest={() => void handleParcelCancel()}
        counterpartName={conversation?.participant?.name}
      />

      {/* ───────── Offer composer modal ───────── */}
      <OfferComposerModal
        open={!!offerComposer}
        mode={offerComposer?.mode ?? "seed"}
        pending={offerPending === "seed" || offerPending === "counter"}
        // A first offer seeds from what the deal already knows (previous
        // agreement -> last offer -> the listing's asking price); a counter
        // still seeds from the offer being responded to.
        currentAmount={
          offerComposer?.mode === "counter"
            ? liveOffer?.amount ?? null
            : activeDeal?.pricing?.suggested_amount ?? null
        }
        currencySymbol={offerCurrencySymbol}
        onCancel={() => {
          if (offerPending !== "seed" && offerPending !== "counter") setOfferComposer(null);
        }}
        onSubmit={(input) => void handleSubmitOffer(input)}
      />

      {/* ───────── Emoji picker ───────── */}
      <EmojiPicker
        open={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onEmojiSelected={(e) => setDraft((prev) => prev + e.emoji)}
      />
    </Screen>
  );
}

// ───────────────────────── Styles ─────────────────────────

const screenStyles = StyleSheet.create({
  // Offer bar (above the composer)
  dealContext: {
    paddingHorizontal: 14,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  dealContextText: { fontSize: 11, lineHeight: 15, color: colors.subtleText },
  dealContextName: { fontWeight: "700", color: colors.mutedText },

  // Offer feedback banner wrap
  offerBannerWrap: { paddingHorizontal: 14, paddingTop: 10 },
});

const styles = { ...chatStyles, ...screenStyles };
