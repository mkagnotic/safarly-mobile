import { useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
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
import { BUDDY_ENTRY_ID, buddyEntryLabel } from "@/utils/buddyEntry";
import { dealContextLine } from "@/utils/dealContext";
import { ChatWorkflowPin } from "@/features/messages/ChatWorkflowPin";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { dismissChatNotifications, setActiveChat } from "@/services/notifications/push";
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
import { appendWithinCap, canUnblockConversation } from "./chat/lib/chatModerationRules";
import { MESSAGE_MAX_LENGTH } from "./chat/lib/chatSendRules";
import { AttachSheet } from "./chat/components/AttachSheet";
import { BubbleMenuSheet } from "./chat/components/BubbleMenuSheet";
import { BuddyPin } from "./chat/components/BuddyPin";
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
  // While this chat is on screen its pushes show no banner, and opening it clears
  // its notifications from the tray - how every chat app behaves (27 Oct 2026).
  useFocusEffect(
    useCallback(() => {
      if (!conversationId) return undefined;
      setActiveChat(conversationId);
      void dismissChatNotifications(conversationId);
      return () => setActiveChat(null);
    }, [conversationId]),
  );
  const fallbackName = route.params?.name ?? "Conversation";
  const source = route.params?.source ?? "messages";
  // Opened from a Travel Buddy card while the chat stays a parcel thread: open on
  // the travel-buddy entry for that trip.
  const buddyListingId = route.params?.buddyListingId ?? null;
  // A link that names a deal opens on it - notification `dealId`, or `?deal=` on a
  // `safarly://messages/:id` link (React Navigation passes query keys as params).
  // Web parity: `useThreadDeal` dealHint.
  const dealHint =
    route.params?.dealId ?? (route.params as { deal?: string } | undefined)?.deal ?? null;
  const fallbackBackTarget = getBackTarget(source);

  const {
    conversation, acceptMatch, declineMatch, refetchConversations,
    participantName, participantInitials, participantId, participantAvatarUrl, participantVerified,
  } = useChatConversation({ conversationId, fallbackName, user });
  // ───────── Server-owned workflow (pinned action bar) ─────────
  const {
    activeDeal, workflow, deals, selectedDealId, selectDeal, refetch: refetchActiveDeal,
    buddy, buddySelected, switchingDeal, loading: activeDealLoading,
  } = useActiveDeal(conversationId, buddyListingId, dealHint);

  // Header badge, match banner and match-action subject — see `useChatMatchStatus`.
  const {
    matchStatus, matchableDeal, isBlocked, matchedByOther, matchedByMe, wasUnmatched, isDeclined,
    canSend, userRole, isMatched, matchBannerVisible,
  } = useChatMatchStatus({ conversation, conversationId, activeDeal, workflow, user });
  // Only the person who blocked sees Unblock and "You blocked {name}" (flow-18 bug 3):
  // the other side got the server's FORBIDDEN. Same rule as web matchState.ts.
  const canUnblock = canUnblockConversation(isBlocked, conversation?.blocked_by, user?.id);

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
  // The travel-buddy entry counts as one more thing to choose between.
  const selectedDealLabel = useMemo(() => {
    // Web's rule (see `utils/dealContext.ts`): no switcher, no line; a lone deal
    // beside the buddy entry is not named.
    const line = dealContextLine({
      selectableCount: selectableDeals(deals ?? [], selectedDealId).length,
      hasBuddy: !!buddy,
      buddySelected,
    });
    if (line === "buddy" && buddy) return { full: buddyEntryLabel(buddy) };
    if (line !== "deal") return null;
    return labelDeals(deals ?? []).get(selectedDealId ?? "") ?? null;
  }, [deals, selectedDealId, buddy, buddySelected]);

  const liveOffer = useMemo(() => {
    const live = offerState.live;
    const fromThread = live && settledOfferIds.includes(live.offerId) ? null : live;
    // The selected deal's open offer, from the server (23 Oct 2026): the thread
    // only holds the messages loaded so far, so in a long chat the offer card was
    // not among them — Counter opened as "Make an offer" and the bar fell back to
    // a generic pin. The server's deal is the authority; the thread's card only
    // adds the message id that makes the in-thread card actionable.
    const server = activeDeal?.offer;
    if (server && server.status === "open" && !settledOfferIds.includes(server.offer_id)) {
      if (fromThread?.offerId === server.offer_id) return fromThread;
      return {
        messageId: "",
        offerId: server.offer_id,
        carrierRequestId: activeDeal?.carrier_request_id,
        amount: Number(server.amount),
        currency: server.currency,
        mine: server.proposed_by === user?.id,
      };
    }
    // No open offer on the selected deal: a card from ANOTHER deal must not drive it.
    if (activeDeal && fromThread?.carrierRequestId && fromThread.carrierRequestId !== activeDeal.carrier_request_id) return null;
    return fromThread;
  }, [offerState.live, settledOfferIds, activeDeal, user?.id]);

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
  // The deal's currency (the parcel's) first — the server makes every offer and
  // counter in it — then the live offer's; a rupee deal showed "$" (22 Oct 2026).
  const offerCurrencySymbol = currencySymbol(activeDeal?.pricing?.currency ?? liveOffer?.currency);

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
    conversationId, conversation, participantName, activeDeal, matchableDeal, navigation, refetchConversations,
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
    rejectOffer, markOfferSettled, setActionMenuOpen, refetchActiveDeal,
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

  const { handleReachOldest } = useChatListScroll({
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
          participantVerified={participantVerified}
          matchStatus={matchStatus}
          isBlocked={isBlocked}
          matchedByOther={matchedByOther}
          matchedByMe={matchedByMe}
          isDeclined={isDeclined}
          typing={typing}
          online={online}
        />

        {/* ───────── Match-state banner ───────── */}
        {/* A parcel handshake - hidden while the travel-buddy entry is on screen. */}
        {buddySelected ? null : <MatchStateBanner
          participantName={participantName}
          matchedByOther={matchedByOther}
          matchedByMe={matchedByMe}
          isDeclined={isDeclined}
          wasUnmatched={wasUnmatched}
          isBlocked={isBlocked}
          canUnblock={canUnblock}
          matchBusy={matchBusy}
          matchPending={matchPending}
          decliningPending={decliningPending}
          setMatchModalOpen={setMatchModalOpen}
          setDeclineOpen={setDeclineOpen}
        />}

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
          handleReachOldest={handleReachOldest}
        />

        {/* Only rendered when the thread actually holds more than one delivery. */}
        <ChatDealSwitcher
          deals={deals}
          selectedDealId={buddySelected ? BUDDY_ENTRY_ID : selectedDealId}
          onSelect={selectDeal}
          buddy={buddy}
        />

        {selectedDealLabel ? (
          <View style={styles.dealContext}>
            <Text style={styles.dealContextText}>
              This step is for <Text style={styles.dealContextName}>{selectedDealLabel.full}</Text>
            </Text>
          </View>
        ) : null}

        {/* ───────── Travel-buddy entry (shared chat) ───────── */}
        {buddySelected && buddy && conversationId ? (
          <BuddyPin
            conversationId={conversationId}
            buddy={buddy}
            counterpartName={conversation?.participant?.name ?? participantName}
            onChanged={() => { void refetchActiveDeal(); void refetch(); }}
          />
        ) : null}

        {/* An edit made the deal stop fitting (route, dates, weight): warn, never
            auto-cancel — same words as web (23 Oct 2026). */}
        {/* Another deal was tapped: a loader in the step's place, never the old deal's step. */}
        {/* Also on the first load, so the step area is a skeleton, not empty. */}
        {!buddySelected && (switchingDeal || (activeDealLoading && !workflow)) ? (
          <View style={styles.dealSwitching} accessibilityRole="progressbar" accessibilityLabel="Loading this delivery" testID="deal-switching">
            <View style={styles.dealSwitchingText}>
              <SkeletonBlock style={styles.dealSwitchingLine} />
              <SkeletonBlock style={[styles.dealSwitchingLine, styles.dealSwitchingLineShort]} />
            </View>
            <SkeletonBlock style={styles.dealSwitchingButton} />
          </View>
        ) : null}

        {!buddySelected && !switchingDeal && activeDeal?.fit_warnings?.length ? (
          <View style={styles.fitWarning} accessibilityRole="alert" testID="deal-fit-warning">
            {activeDeal.fit_warnings.map((w) => (
              <View key={w} style={styles.fitWarningRow}>
                <Ionicons name="warning-outline" size={14} color="#92400E" />
                <Text style={styles.fitWarningText}>{w}</Text>
              </View>
            ))}
          </View>
        ) : null}

        {/* ───────── Workflow pin (server FSM) ───────── */}
        {!buddySelected && !switchingDeal && showWorkflowPin && workflow ? (
          <ChatWorkflowPin
            workflow={workflow}
            activeDeal={activeDeal}
            onAction={handlePinAction}
            uploadTries={{ travelDoc: travelDoc.doc, parcelReview: parcelReview.review }}
          />
        ) : null}

        {/* ───────── Offer bar ───────── */}
        {!buddySelected && !switchingDeal && supportsOffers && liveOffer ? (
          <OfferBar
            liveOffer={liveOffer}
            participantName={participantName}
            offerPending={offerPending}
            handleAcceptOffer={handleAcceptOffer}
            handleDeclineOffer={handleDeclineOffer}
            handleOpenOfferComposer={handleOpenOfferComposer}
            waitingOnPayouts={activeDeal?.carrier_payout_ready === false}
            viewerIsCarrier={activeDeal?.viewer_role === "carrier"}
            onSetUpPayouts={() => navigation.navigate("PayoutSetupTab")}
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
        matchedByMe={matchedByMe}
        isBlocked={isBlocked}
        canUnblock={canUnblock}
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
        loadError={travelDoc.error}
        onRetryLoad={() => void travelDoc.refetch()}
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
        loadError={parcelReview.error}
        onRetryLoad={() => void parcelReview.refetch()}
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
          offerComposer?.mode === "counter" || offerComposer?.mode === "revise"
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
        // The emoji counts toward the 2,000 cap like any character: it goes in only
        // if the whole emoji fits (flow-18 bug 15); the composer counter shows the cap.
        onEmojiSelected={(e) => setDraft((prev) => appendWithinCap(prev, e.emoji, MESSAGE_MAX_LENGTH))}
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
  fitWarning: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: "#FDE68A", backgroundColor: "#FFFBEB", paddingHorizontal: 14, paddingVertical: 8, gap: 4 },
  fitWarningRow: { flexDirection: "row", alignItems: "flex-start", gap: 6 },
  fitWarningText: { flex: 1, fontSize: 12, lineHeight: 16, color: "#78350F" },
  dealSwitching: { flexDirection: "row", alignItems: "center", gap: 12, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingHorizontal: 14, paddingVertical: 12 },
  dealSwitchingText: { flex: 1, gap: 8 },
  dealSwitchingLine: { height: 12, width: "80%" },
  dealSwitchingLineShort: { width: "50%" },
  dealSwitchingButton: { height: 40, width: 96, borderRadius: 12 },
});

const styles = { ...chatStyles, ...screenStyles };
