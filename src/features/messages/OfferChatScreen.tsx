import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  Keyboard,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import EmojiPicker from "rn-emoji-keyboard";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { DeclineMatchModal } from "@/components/chat/DeclineMatchModal";
import {
  MatchConfirmationModal,
  type MatchUserRole,
} from "@/components/chat/MatchConfirmationModal";
import { MediaGalleryModal } from "@/components/chat/MediaGalleryModal";
import { OfferComposerModal, type OfferComposerSubmit } from "@/components/chat/OfferComposerModal";
import { ParcelReviewModal } from "@/components/chat/ParcelReviewModal";
import { ReportMessageModal } from "@/components/chat/ReportMessageModal";
import { TravelDocModal } from "@/components/chat/TravelDocModal";
import { ChatWorkflowPin } from "@/features/messages/ChatWorkflowPin";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useActiveDeal } from "@/hooks/api/useActiveDeal";
import { useParcelReview } from "@/hooks/api/useParcelReview";
import { useTravelDoc } from "@/hooks/api/useTravelDoc";
import { useChatMessages, type DisplayMessage } from "@/hooks/api/useChatMessages";
import { useMyConversations } from "@/hooks/api/useMyConversations";
import { useOffers } from "@/hooks/api/useOffers";
import {
  resolveOffers,
  type OfferCardActions,
  type OfferRenderState,
} from "@/features/messages/offerResolution";
import { useConversationPresence } from "@/hooks/realtime/useConversationPresence";
import { MainTabParamList } from "@/navigation/types";
import { setActiveConversation } from "@/store/activeConversation";
import {
  getErrorMessage,
  messagesApi,
  type Conversation,
  type OfferAcceptPayload,
  type OfferCardPayload,
  type OfferStatus,
  type ParcelReviewReason,
  type RNUploadFile,
  type SystemEventPayload,
} from "@/services/api";
import { colors } from "@/theme/colors";

type ChatNav = BottomTabNavigationProp<MainTabParamList, "OfferChatTab">;
type ChatRoute = RouteProp<MainTabParamList, "OfferChatTab">;

/** 10 MB — same cap as web (`MAX_FILE_SIZE` in CustomerMessages). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function getBackTarget(source: "home" | "offers" | "messages" | "buddies" | "travels") {
  switch (source) {
    case "home":
      return "Home" as const;
    case "messages":
      return "MessagesTab" as const;
    case "buddies":
      return "Buddies" as const;
    // "Parcels" is the My Travels tab — chats opened from a parcel card there
    // should return to it rather than dropping the user on Offers.
    case "travels":
      return "Parcels" as const;
    default:
      return "OffersTab" as const;
  }
}

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatBubbleTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

/**
 * Web parity (`CustomerMessages.tsx:287-291`): for buddy context, both sides
 * are "sender"; for booking, `participant_1` is the sender and `participant_2`
 * is the carrier. Defaults to "sender" when we don't know enough yet.
 */
function getRoleForConversation(
  conv: Conversation | null,
  currentUserId: string | null,
): MatchUserRole {
  if (!conv) return "sender";
  if (conv.context_type === "buddy") return "sender";
  if (currentUserId && conv.participant_1 === currentUserId) return "sender";
  return "carrier";
}

export function OfferChatScreen() {
  const navigation = useNavigation<ChatNav>();
  const route = useRoute<ChatRoute>();
  const { user } = useAuth();
  // The conversation hides the tab bar (FULLSCREEN_TAB), so the composer is now
  // the bottom-most element and has to clear the gesture bar itself.
  const insets = useSafeAreaInsets();
  /**
   * Height the keyboard currently occupies, straight from the OS.
   *
   * We reserve this as padding rather than relying on KeyboardAvoidingView,
   * which cannot work on Android under edge-to-edge (the window is never
   * resized, so it has nothing to measure). Reading the real height is exact on
   * both platforms and is what makes the composer sit flush on the keyboard.
   *
   * iOS uses the `Will` events so the layout moves with the system animation
   * instead of snapping after it; Android only fires `Did` reliably.
   */
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const show = Keyboard.addListener(showEvent, (e) =>
      setKeyboardHeight(e?.endCoordinates?.height ?? 0),
    );
    const hide = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  const keyboardOpen = keyboardHeight > 0;
  // With the keyboard up the gesture bar is behind it, so reserving that inset
  // too would float the composer on a band of dead space.
  const composerBottomPad = keyboardOpen
    ? 10
    : Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 10);
  // Only iOS needs a manual lift: it never resizes the window for the keyboard.
  // On Android under Expo 54 edge-to-edge the OS DOES resize now (the IME inset
  // is consumed), so the layout already ends above the keyboard — adding
  // keyboardHeight there double-counts and floats the composer up with a big gap.
  const containerKeyboardPad = Platform.OS === "ios" ? keyboardHeight : 0;

  const conversationId = route.params?.conversationId ?? null;
  const fallbackName = route.params?.name ?? "Conversation";
  const source = route.params?.source ?? "offers";
  const fallbackBackTarget = getBackTarget(source);

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
  const matchStatus = conversation?.match_status ?? "pending";
  const isBlocked = matchStatus === "blocked";
  const matchedByOther =
    matchStatus === "pending" &&
    !!conversation?.matched_by &&
    conversation.matched_by !== user?.id;
  const matchedByMe =
    matchStatus === "pending" &&
    !!conversation?.matched_by &&
    conversation.matched_by === user?.id;
  // `matched_at` persists across unmatch, so its presence while pending (with no
  // current `matched_by`) marks a dissolved match vs a never-matched thread.
  const wasUnmatched =
    matchStatus === "pending" &&
    !conversation?.matched_by &&
    !!conversation?.matched_at;
  const isDeclined = matchStatus === "declined";
  const canSend = !isBlocked && !!conversationId;

  const userRole = useMemo(
    () => getRoleForConversation(conversation, user?.id ?? null),
    [conversation, user?.id],
  );

  const {
    messages,
    loading,
    loadingOlder,
    hasMore,
    error,
    uploading,
    refetch,
    loadOlder,
    send,
    retry,
    discard,
  } = useChatMessages({ conversationId, currentUserId: user?.id ?? null });

  // Realtime presence + typing for the OTHER side. Auto-no-ops until we know
  // both ids — `participantId` lands once `useMyConversations` returns.
  const { online, typing, notifyTyping, stopTyping } = useConversationPresence(
    conversationId,
    participantId,
  );

  // ───────── In-chat offers ─────────
  const {
    pending: offerPending,
    seedOffer,
    postOffer,
    acceptOffer,
    rejectOffer,
  } = useOffers(conversationId);
  const offerState = useMemo(
    () => resolveOffers(messages, user?.id ?? null),
    [messages, user?.id],
  );
  const liveOffer = offerState.live;
  const isMatched = matchStatus === "matched";

  // ───────── Server-owned workflow (pinned action bar) ─────────
  const { activeDeal, workflow, refetch: refetchActiveDeal } = useActiveDeal(conversationId);
  // The match banner and the live-offer bar already own some states, so the pin
  // defers to them to avoid two controls doing the same job. But it defers only
  // when that bespoke UI is ACTUALLY on screen: a conversation just opened from
  // search isn't in the conversations list yet, so `conversation` is null, every
  // match-banner branch is false, and the banner renders nothing — which is why
  // the match prompt went missing. In that case the pin (driven directly by the
  // server FSM per conversation id) shows `request_match`, matching web.
  const matchBannerVisible =
    matchedByOther || matchedByMe || isDeclined || wasUnmatched || isBlocked;
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
  const offerCurrencySymbol = liveOffer?.currency === "INR" ? "₹" : "$";

  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<RNUploadFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // Tracks whether the LAST send attempt for `pendingFile` failed, so the
  // composer preview row can show a retry icon (web parity:
  // CustomerMessages.tsx:905-908). Cleared whenever a new file is picked or
  // a send succeeds.
  const [uploadFailed, setUploadFailed] = useState(false);
  // Two separate sheets: the composer paperclip opens the attach sheet; the
  // header kebab opens the conversation-actions sheet (web parity).
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportUserPending, setReportUserPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [decliningPending, setDecliningPending] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchPending, setMatchPending] = useState(false);
  const [travelDocOpen, setTravelDocOpen] = useState(false);
  const [parcelReviewOpen, setParcelReviewOpen] = useState(false);

  // ───────── Travel-document verification ─────────
  // Only fetch the doc while the deal is actually in a verification stage (or the
  // modal is open), so we don't hit the endpoint for every conversation. The pin
  // CTA itself comes from the server FSM regardless; this just backs the modal.
  const travelDocRequestId =
    workflow?.state === "TRAVEL_VERIFICATION" ||
    workflow?.state === "ADMIN_REVIEW" ||
    travelDocOpen
      ? activeDeal?.carrier_request_id ?? null
      : null;
  const travelDoc = useTravelDoc(travelDocRequestId);

  // ───────── Parcel-photo review ─────────
  const parcelReviewRequestId =
    workflow?.state === "PARCEL_REVIEW" || parcelReviewOpen
      ? activeDeal?.carrier_request_id ?? null
      : null;
  const parcelReview = useParcelReview(parcelReviewRequestId);
  const [reportTarget, setReportTarget] = useState<DisplayMessage | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<DisplayMessage | null>(null);
  const [offerComposer, setOfferComposer] = useState<{ mode: "seed" | "counter" } | null>(null);
  const [offerBanner, setOfferBanner] = useState<{
    variant: "success" | "error" | "info" | "warning";
    title: string;
    message?: string;
  } | null>(null);

  // Auto-dismiss the offer feedback banner like a standard toast — success/info
  // clear quickly, errors linger a little longer so they stay readable. The
  // manual × still works: dismissing sets it to null, which runs this cleanup.
  useEffect(() => {
    if (!offerBanner) return;
    const ms = offerBanner.variant === "error" ? 5000 : 2800;
    const timer = setTimeout(() => setOfferBanner(null), ms);
    return () => clearTimeout(timer);
  }, [offerBanner]);
  // Two destructive-confirm states reuse one ConfirmActionModal — `null` when
  // closed, "block" or "unmatch" when open. Mirrors web's `confirmAction`
  // pattern in `ChatActionDropdown.tsx:46`.
  const [confirmAction, setConfirmAction] = useState<"block" | "unmatch" | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  const flatListRef = useRef<FlatList<DisplayMessage>>(null);
  // Track newest message timestamp seen so we only auto-scroll on new arrivals,
  // not on `loadOlder()` which prepends older rows. Web does the same via
  // `latestCreatedAtRef` (CustomerMessages.tsx:181-194).
  const latestSeenRef = useRef<number>(0);

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

  // A chat opened straight from Search/Matches was just created, so it isn't in
  // the conversations list yet — leaving the header name/avatar, presence and
  // the match banner unhydrated. Pull the list once when we're on a conversation
  // that isn't present so those fill in. (The workflow pin already renders the
  // right state meanwhile, since it fetches by id.)
  useEffect(() => {
    if (conversationId && !conversation) void refetchConversations();
  }, [conversationId, conversation, refetchConversations]);

  // Follow to the newest message when the keyboard opens. Without this the
  // thread just gets shorter and you're left reading older messages while
  // typing — every messaging app scrolls down here. The delay lets the
  // keyboard-driven resize settle before measuring.
  useEffect(() => {
    if (!keyboardOpen) return;
    const timer = setTimeout(
      () => flatListRef.current?.scrollToEnd({ animated: true }),
      80,
    );
    return () => clearTimeout(timer);
  }, [keyboardOpen]);

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

  // Mark incoming messages as delivered when the screen mounts with a real conversation.
  useEffect(() => {
    if (!conversationId) return;
    void messagesApi.markDelivered(conversationId).catch(() => {
      /* fire-and-forget — ignore failures */
    });
  }, [conversationId]);

  const handlePickImage = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow photo access to attach images.",
          variant: "warning",
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        // SDK 54 deprecated MediaTypeOptions in favor of the string-array form.
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Images must be under 10 MB.", variant: "error" });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      setPendingFile(file);
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't pick image", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow camera access to take photos.",
          variant: "warning",
        });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Same 10 MB cap as the library picker — high-res phones can produce
      // 12-15 MB raw captures.
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({
          title: "Too large",
          message: "Photos must be under 10 MB.",
          variant: "error",
        });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.fileName ?? `camera-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      setPendingFile(file);
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't take photo", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const handlePickDocument = useCallback(async () => {
    setAttachMenuOpen(false);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "video/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Files must be under 10 MB.", variant: "error" });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      };
      setPendingFile(file);
      setPreviewUri(null);
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingFile(null);
    setPreviewUri(null);
    setUploadFailed(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed && !pendingFile) return;
    if (!canSend) return;
    const fileToSend = pendingFile;
    const draftSnapshot = trimmed;
    // Clear text immediately for responsive feel; keep the file in the
    // preview row until we know whether the upload+send succeeded so the
    // user can retry it without re-picking.
    setDraft("");
    setUploadFailed(false);
    stopTyping();
    try {
      await send({ text: draftSnapshot, file: fileToSend });
      // Success: drop the preview now that the bubble is in flight.
      if (fileToSend) clearPending();
    } catch (err) {
      // Restore the draft text so the user doesn't lose what they typed.
      if (draftSnapshot) setDraft(draftSnapshot);
      if (fileToSend) setUploadFailed(true);
      showToast({
        title: "Couldn't send",
        message: getErrorMessage(err),
        variant: "error",
      });
    }
  }, [draft, pendingFile, canSend, clearPending, send, stopTyping]);

  // Same as `handleSend` but always retries with the current pending file —
  // bound to the retry icon on the preview row.
  const handleRetryUpload = useCallback(() => {
    if (!pendingFile) return;
    void handleSend();
  }, [pendingFile, handleSend]);

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (next.length > 0) notifyTyping();
      else stopTyping();
    },
    [notifyTyping, stopTyping],
  );

  const handleAccept = useCallback(async () => {
    if (!conversationId) return;
    setMatchPending(true);
    try {
      await acceptMatch(conversationId);
      setMatchModalOpen(false);
      showToast({ title: "Matched", variant: "success", duration: 1800 });
    } catch (err) {
      showToast({ title: "Couldn't accept", message: getErrorMessage(err), variant: "error" });
    } finally {
      setMatchPending(false);
    }
  }, [conversationId, acceptMatch]);

  const handleDeclineConfirm = useCallback(
    async (reason: string) => {
      if (!conversationId) return;
      setDecliningPending(true);
      try {
        await declineMatch(conversationId, reason || undefined);
        setDeclineOpen(false);
        showToast({ title: "Match declined", variant: "info", duration: 1800 });
      } catch (err) {
        showToast({
          title: "Couldn't decline",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setDecliningPending(false);
      }
    },
    [conversationId, declineMatch],
  );

  // Both block and unmatch open the same shared ConfirmActionModal — the
  // `confirmAction` slot decides title/body/icon. Web does the same with one
  // Dialog + a "block" | "unmatch" enum (ChatActionDropdown.tsx:46-72).
  const handleUnmatch = useCallback(() => {
    if (!conversationId) return;
    setActionMenuOpen(false);
    setConfirmAction("unmatch");
  }, [conversationId]);

  const handleBlock = useCallback(() => {
    if (!conversationId) return;
    setActionMenuOpen(false);
    setConfirmAction("block");
  }, [conversationId]);

  const handleConfirmAction = useCallback(async () => {
    if (!conversationId || !confirmAction) return;
    setConfirmPending(true);
    try {
      if (confirmAction === "block") {
        await messagesApi.blockUser(conversationId);
        showToast({ title: "Blocked", variant: "info" });
      } else {
        await messagesApi.unmatchConversation(conversationId);
        showToast({ title: "Unmatched", variant: "info" });
      }
      setConfirmAction(null);
      // Flip the match-state banner instantly instead of waiting on realtime.
      void refetchConversations();
    } catch (err) {
      // Guard may reject if the state moved (e.g. already unmatched). Resync.
      void refetchConversations();
      showToast({
        title: confirmAction === "block" ? "Couldn't block" : "Couldn't unmatch",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setConfirmPending(false);
    }
  }, [conversationId, confirmAction, refetchConversations]);

  const handleUnblock = useCallback(async () => {
    if (!conversationId) return;
    setActionMenuOpen(false);
    try {
      await messagesApi.unblockUser(conversationId);
      showToast({ title: "Unblocked", variant: "info" });
      void refetchConversations();
    } catch (err) {
      void refetchConversations();
      showToast({
        title: "Couldn't unblock",
        message: getErrorMessage(err),
        variant: "error",
      });
    }
  }, [conversationId, refetchConversations]);

  // ───────── Bubble long-press: copy / report ─────────

  const handleBubbleLongPress = useCallback((message: DisplayMessage) => {
    setBubbleMenu(message);
  }, []);

  const handleCopyText = useCallback(async () => {
    const target = bubbleMenu;
    setBubbleMenu(null);
    if (!target?.text) return;
    try {
      await Clipboard.setStringAsync(target.text);
      showToast({ title: "Copied", variant: "info", duration: 1200 });
    } catch (err) {
      showToast({ title: "Couldn't copy", message: getErrorMessage(err), variant: "error" });
    }
  }, [bubbleMenu]);

  const handleOpenReport = useCallback(() => {
    const target = bubbleMenu;
    setBubbleMenu(null);
    if (!target) return;
    // Skip pending/local-only messages — they have no server id to report.
    if (target._clientStatus) {
      showToast({
        title: "Can't report yet",
        message: "Wait until the message has been sent.",
        variant: "warning",
      });
      return;
    }
    setReportTarget(target);
  }, [bubbleMenu]);

  const handleSubmitReport = useCallback(
    async ({ reason, details }: { reason: string; details: string | undefined }) => {
      const target = reportTarget;
      if (!target) return;
      setReportPending(true);
      try {
        await messagesApi.reportMessage(target.id, reason, details);
        setReportTarget(null);
        showToast({
          title: "Reported",
          message: "Thank you for keeping the community safe.",
          variant: "success",
        });
      } catch (err) {
        showToast({
          title: "Couldn't submit report",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setReportPending(false);
      }
    },
    [reportTarget],
  );

  // ───────── Offer handlers ─────────

  const handleOpenOfferComposer = useCallback(() => {
    setActionMenuOpen(false);
    setOfferBanner(null);
    // Counter the live offer when one exists (reuses its carrier_request);
    // otherwise seed a brand-new offer.
    setOfferComposer({ mode: liveOffer?.carrierRequestId ? "counter" : "seed" });
  }, [liveOffer]);

  const handleSubmitOffer = useCallback(
    async ({ amount, note }: OfferComposerSubmit) => {
      if (!offerComposer) return;
      // Post into the EXISTING deal whenever one exists. Web always sends the
      // offer with `activeDeal.carrier_request_id` (`ChatOfferPrompt`), even for
      // the very first fee offer. `seed-offer` instead auto-detects a brand-new
      // trip+parcel pair and 404s once the listings are locked into a deal — so
      // it's only for starting a deal from scratch (no carrier_request yet).
      const carrierRequestId =
        liveOffer?.carrierRequestId ?? activeDeal?.carrier_request_id ?? null;
      try {
        if (carrierRequestId) {
          await postOffer({ carrier_request_id: carrierRequestId, amount, note });
        } else {
          await seedOffer({ amount, note });
        }
        setOfferComposer(null);
        setOfferBanner({
          variant: "success",
          title: liveOffer ? "Counter sent" : "Offer sent",
        });
      } catch (err) {
        setOfferComposer(null);
        setOfferBanner({
          variant: "error",
          title: "Couldn't send offer",
          message: getErrorMessage(err),
        });
      }
    },
    [offerComposer, liveOffer, activeDeal?.carrier_request_id, postOffer, seedOffer],
  );

  /**
   * Runs a workflow-pin CTA. The pin is a projection of the server FSM; this
   * maps each `cta.code` to the mobile capability that satisfies it. Codes for
   * stages that already have bespoke UI (match handshake, live offer) route to
   * those same handlers, so behaviour stays consistent if the pin ever shows
   * them. Travel-doc and parcel-review are not yet built on mobile (their own
   * phases) — those codes explain that rather than dead-ending.
   */
  const handlePinAction = useCallback(
    (code: string) => {
      const bookingId = activeDeal?.booking_id ?? null;
      switch (code) {
        case "request_match":
        case "request_match_again":
          setMatchModalOpen(true);
          return;
        case "accept_match":
          void handleAccept();
          return;
        case "make_offer":
        case "accept_offer":
          handleOpenOfferComposer();
          return;
        case "pay":
        case "pay_grace":
          if (bookingId) navigation.navigate("PayBookingTab", { bookingId });
          return;
        case "verify_otp":
          if (bookingId) navigation.navigate("OtpVerificationTab", { bookingId });
          return;
        case "generate_otp":
        case "share_otp":
        case "accept_handoff":
          if (bookingId) navigation.navigate("BookingsTab", { expandId: bookingId });
          return;
        case "completed":
          if (bookingId) navigation.navigate("DeliveryReviewTab", { bookingId });
          return;
        case "upload_travel_doc":
        case "review_travel_doc":
          setTravelDocOpen(true);
          return;
        case "upload_parcel_photos":
        case "review_parcel_photos":
          setParcelReviewOpen(true);
          return;
        default:
          return;
      }
    },
    [activeDeal?.booking_id, handleAccept, handleOpenOfferComposer, navigation],
  );

  // ───────── Travel-doc action handlers ─────────
  // Each forwards to the hook (which refetches the doc), toasts, and — for the
  // actions that advance the FSM (approve/withdraw) — nudges the workflow pin so
  // it moves on without waiting for the realtime round-trip.
  const handleDocUpload = useCallback(
    async (file: RNUploadFile) => {
      try {
        await travelDoc.upload(file);
        showToast({ title: "Document uploaded", variant: "success", duration: 1800 });
      } catch (err) {
        showToast({ title: "Upload failed", message: getErrorMessage(err), variant: "error" });
      }
    },
    [travelDoc],
  );

  const handleDocApprove = useCallback(async () => {
    try {
      await travelDoc.approve();
      setTravelDocOpen(false);
      showToast({ title: "Document approved", variant: "success", duration: 1800 });
      void refetchActiveDeal();
    } catch (err) {
      showToast({ title: "Couldn't approve", message: getErrorMessage(err), variant: "error" });
    }
  }, [travelDoc, refetchActiveDeal]);

  const handleDocReject = useCallback(
    async (reason: string) => {
      try {
        await travelDoc.reject(reason);
        showToast({ title: "Re-upload requested", variant: "info", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        showToast({
          title: "Couldn't request re-upload",
          message: getErrorMessage(err),
          variant: "error",
        });
      }
    },
    [travelDoc, refetchActiveDeal],
  );

  const handleDocAdminReview = useCallback(async () => {
    try {
      await travelDoc.requestAdminReview();
      showToast({ title: "Admin review requested", variant: "info", duration: 1800 });
    } catch (err) {
      showToast({ title: "Couldn't escalate", message: getErrorMessage(err), variant: "error" });
    }
  }, [travelDoc]);

  const handleDocCancelMatch = useCallback(async () => {
    try {
      await travelDoc.withdraw();
      setTravelDocOpen(false);
      showToast({ title: "Match cancelled", variant: "info", duration: 1800 });
      void refetchActiveDeal();
      void refetchConversations();
    } catch (err) {
      showToast({ title: "Couldn't cancel", message: getErrorMessage(err), variant: "error" });
    }
  }, [travelDoc, refetchActiveDeal, refetchConversations]);

  // ───────── Parcel-review action handlers ─────────
  const handleParcelUpload = useCallback(
    async (files: RNUploadFile[]) => {
      try {
        await parcelReview.upload(files);
        showToast({ title: "Photos submitted", variant: "success", duration: 1800 });
      } catch (err) {
        showToast({ title: "Upload failed", message: getErrorMessage(err), variant: "error" });
      }
    },
    [parcelReview],
  );

  const handleParcelApprove = useCallback(async () => {
    try {
      await parcelReview.approve();
      setParcelReviewOpen(false);
      showToast({ title: "Parcel approved", variant: "success", duration: 1800 });
      void refetchActiveDeal();
    } catch (err) {
      showToast({ title: "Couldn't approve", message: getErrorMessage(err), variant: "error" });
    }
  }, [parcelReview, refetchActiveDeal]);

  const handleParcelReject = useCallback(
    async (reason: ParcelReviewReason, note?: string) => {
      try {
        await parcelReview.reject(reason, note);
        showToast({ title: "Changes requested", variant: "info", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        showToast({
          title: "Couldn't request changes",
          message: getErrorMessage(err),
          variant: "error",
        });
      }
    },
    [parcelReview, refetchActiveDeal],
  );

  const handleParcelCancel = useCallback(async () => {
    try {
      await parcelReview.cancel();
      setParcelReviewOpen(false);
      showToast({ title: "Request cancelled", variant: "info", duration: 1800 });
      void refetchActiveDeal();
      void refetchConversations();
    } catch (err) {
      showToast({ title: "Couldn't cancel", message: getErrorMessage(err), variant: "error" });
    }
  }, [parcelReview, refetchActiveDeal, refetchConversations]);

  // ───────── Header action-menu handlers (web parity) ─────────
  const isArchived = conversation?.archived === true;

  const handleArchiveToggle = useCallback(async () => {
    if (!conversationId) return;
    setActionMenuOpen(false);
    setArchivePending(true);
    try {
      if (isArchived) {
        await messagesApi.unarchiveConversation(conversationId);
        showToast({ title: "Chat unarchived", variant: "info", duration: 1600 });
      } else {
        await messagesApi.archiveConversation(conversationId);
        showToast({ title: "Chat archived", variant: "info", duration: 1600 });
      }
      void refetchConversations();
    } catch (err) {
      showToast({ title: "Couldn't update", message: getErrorMessage(err), variant: "error" });
    } finally {
      setArchivePending(false);
    }
  }, [conversationId, isArchived, refetchConversations]);

  // Raise a dispute: jump to the filing screen pre-scoped to this deal's booking
  // when one exists, otherwise the disputes list where the user can pick one.
  const handleRaiseDispute = useCallback(() => {
    setActionMenuOpen(false);
    const bookingId = activeDeal?.booking_id ?? null;
    if (bookingId) navigation.navigate("FileDisputeTab", { bookingId });
    else navigation.navigate("DisputesTab");
  }, [activeDeal?.booking_id, navigation]);

  // Conversation-level report reuses the message-report endpoint with the
  // conversation id as the target — exactly what web's "Report User" does.
  const handleSubmitUserReport = useCallback(
    async ({ reason, details }: { reason: string; details: string | undefined }) => {
      if (!conversationId) return;
      setReportUserPending(true);
      try {
        await messagesApi.reportMessage(conversationId, reason, details);
        setReportUserOpen(false);
        showToast({
          title: "Reported",
          message: "Thank you for keeping the community safe.",
          variant: "success",
        });
      } catch (err) {
        showToast({
          title: "Couldn't submit report",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setReportUserPending(false);
      }
    },
    [conversationId],
  );

  const handleAcceptOffer = useCallback(
    async (offerId: string) => {
      setOfferBanner(null);
      try {
        const result = await acceptOffer(offerId);
        setOfferBanner({ variant: "success", title: "Offer accepted — match confirmed!" });
        // Only the parcel sender is routed onward to pay (Part 3); the carrier stays here.
        const booking = result.booking;
        if (booking?.id && booking.sender_id === user?.id) {
          navigation.navigate("PayBookingTab", { bookingId: booking.id });
        }
      } catch (err) {
        setOfferBanner({
          variant: "error",
          title: "Couldn't accept offer",
          message: getErrorMessage(err),
        });
      }
    },
    [acceptOffer, navigation, user?.id],
  );

  const handleDeclineOffer = useCallback(
    async (offerId: string) => {
      setOfferBanner(null);
      try {
        await rejectOffer(offerId);
        setOfferBanner({ variant: "info", title: "Offer declined" });
      } catch (err) {
        setOfferBanner({
          variant: "error",
          title: "Couldn't decline offer",
          message: getErrorMessage(err),
        });
      }
    },
    [rejectOffer],
  );

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
    ],
  );

  const keyExtractor = useCallback((item: DisplayMessage) => item.id, []);

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

  // Title-row pill: persistent match-state badge (Matched / Match request /
  // Waiting / Declined / Blocked). Lives next to the name so the subtitle
  // line is free for transient state (typing / online).
  const titleStatus: { label: string; bg: string; fg: string } | null = (() => {
    if (matchStatus === "matched")
      return { label: "Matched", bg: "rgba(34, 195, 93, 0.14)", fg: colors.safe };
    if (isBlocked)
      return { label: "Blocked", bg: "rgba(220, 40, 40, 0.14)", fg: colors.danger };
    if (matchedByOther)
      return { label: "Match request", bg: "rgba(245, 159, 10, 0.16)", fg: colors.warning };
    if (matchedByMe)
      return { label: "Waiting", bg: colors.surfaceMuted, fg: colors.mutedText };
    if (isDeclined)
      return { label: "Declined", bg: "rgba(220, 40, 40, 0.14)", fg: colors.danger };
    return null;
  })();

  // Subtitle: live state only — typing > online > nothing.
  const renderSubtitle = () => {
    if (typing) {
      return (
        <Text style={[styles.headerSubtitle, { color: colors.primary }]}>
          {participantName.split(" ")[0]} is typing…
        </Text>
      );
    }
    if (online) {
      return <Text style={[styles.headerSubtitle, { color: colors.safe }]}>● Online</Text>;
    }
    return null;
  };

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

        - Android (Expo 54 edge-to-edge): the OS resizes the window on keyboard
          open, so this container already ends above the keyboard — we add NO
          padding. (Reserving keyboardHeight here on top of the resize was what
          floated the composer up with a large empty band.)
        - iOS: the window is never resized for the keyboard, so we lift the whole
          container by the real keyboard height instead.

        `keyboardOpen`/`keyboardHeight` are still read from the OS to drive the
        composer's bottom padding and the scroll-to-newest on open.
      */}
      <View style={[styles.flex, { paddingBottom: containerKeyboardPad }]}>
        {/* ───────── Header ───────── */}
        <View style={styles.headerRow}>
          <Pressable
            onPress={goBack}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="chevron-back" size={20} color={colors.text} />
          </Pressable>
          <Pressable
            onPress={handleOpenProfile}
            disabled={!participantId}
            style={styles.headerIdentity}
            accessibilityRole="button"
            accessibilityLabel={`View ${participantName}'s profile`}
          >
            {participantAvatarUrl ? (
              <Image source={{ uri: participantAvatarUrl }} style={styles.headerAvatarImage} />
            ) : (
              <View style={styles.headerAvatar}>
                <Text style={styles.headerAvatarText}>{participantInitials}</Text>
              </View>
            )}
            <View style={styles.headerTextWrap}>
              <View style={styles.headerTitleRow}>
                <Text style={styles.headerTitle} numberOfLines={1}>
                  {participantName}
                </Text>
                {titleStatus ? (
                  <View style={[styles.headerStatusPill, { backgroundColor: titleStatus.bg }]}>
                    <Text style={[styles.headerStatusText, { color: titleStatus.fg }]}>
                      {titleStatus.label}
                    </Text>
                  </View>
                ) : null}
              </View>
              {renderSubtitle()}
            </View>
          </Pressable>
          <Pressable
            onPress={() => setActionMenuOpen(true)}
            style={styles.iconButton}
            accessibilityRole="button"
            accessibilityLabel="Chat actions"
          >
            <Ionicons name="ellipsis-vertical" size={20} color={colors.text} />
          </Pressable>
        </View>

        {/* ───────── Match-state banner ───────── */}
        {matchedByOther ? (
          <View style={[styles.banner, styles.bannerWarning]}>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Match request</Text>
              <Text style={styles.bannerBody}>
                {participantName} wants to match. Accept to start chatting freely.
              </Text>
            </View>
            <View style={styles.bannerActions}>
              <Pressable
                onPress={() => setMatchModalOpen(true)}
                style={[styles.bannerButton, styles.bannerButtonPrimary]}
                accessibilityRole="button"
              >
                <Text style={styles.bannerButtonPrimaryText}>Accept</Text>
              </Pressable>
              <Pressable
                onPress={() => setDeclineOpen(true)}
                style={[styles.bannerButton, styles.bannerButtonOutline]}
                accessibilityRole="button"
              >
                <Text style={styles.bannerButtonOutlineText}>Close</Text>
              </Pressable>
            </View>
          </View>
        ) : matchedByMe ? (
          // Web parity (CustomerMessages.tsx:870-888): dedicated waiting strip
          // when YOU sent a match request and the other side hasn't accepted
          // yet. Distinct visual from the closed/declined state below.
          <View style={[styles.banner, styles.bannerWaiting]}>
            <Ionicons name="hourglass" size={16} color={colors.warning} />
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>Waiting for {participantName.split(" ")[0]}</Text>
              <Text style={styles.bannerBody}>
                You accepted! They'll see your request and decide next.
              </Text>
            </View>
          </View>
        ) : isDeclined || wasUnmatched ? (
          <View style={[styles.banner, styles.bannerMuted]}>
            <View style={styles.bannerTextWrap}>
              <Text style={styles.bannerTitle}>
                {isDeclined ? "Match declined" : "Conversation closed"}
              </Text>
              <Text style={styles.bannerBody}>Send a new match request to reopen.</Text>
            </View>
            <View style={styles.bannerActions}>
              <Pressable
                onPress={() => setMatchModalOpen(true)}
                style={[styles.bannerButton, styles.bannerButtonPrimary]}
                accessibilityRole="button"
              >
                <Text style={styles.bannerButtonPrimaryText}>Match again</Text>
              </Pressable>
            </View>
          </View>
        ) : isBlocked ? (
          <View style={[styles.banner, styles.bannerDanger]}>
            <View style={styles.bannerTextWrap}>
              <Text style={[styles.bannerTitle, { color: colors.danger }]}>
                Conversation blocked
              </Text>
              <Text style={styles.bannerBody}>
                You blocked this user. Open the actions menu to unblock.
              </Text>
            </View>
          </View>
        ) : null}

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
        <View style={styles.flex}>
          {loading && messages.length === 0 ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.centeredBody}>Loading messages…</Text>
            </View>
          ) : error && messages.length === 0 ? (
            <View style={styles.centered}>
              <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
              <Text style={styles.centeredTitle}>Couldn't load messages</Text>
              <Text style={styles.centeredBody}>{getErrorMessage(error)}</Text>
              <Pressable
                style={styles.retryButton}
                onPress={() => void refetch()}
                accessibilityRole="button"
              >
                <Text style={styles.retryButtonText}>Try again</Text>
              </Pressable>
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={keyExtractor}
              renderItem={renderMessage}
              onScroll={handleListScroll}
              scrollEventThrottle={120}
              contentContainerStyle={[
                styles.listContent,
                messages.length === 0 && styles.listContentEmpty,
              ]}
              ListHeaderComponent={
                // WhatsApp-style: no persistent button — scrolling near the top
                // auto-loads older messages (see handleListScroll), and this
                // spinner shows only while that fetch is in flight.
                loadingOlder ? (
                  <View style={styles.loadOlderSpinner}>
                    <ActivityIndicator size="small" color={colors.mutedText} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.centered}>
                  <View style={styles.emptyIconBubble}>
                    <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
                  </View>
                  <Text style={styles.centeredTitle}>Start the conversation</Text>
                  <Text style={styles.centeredBody}>Send a message to break the ice.</Text>
                </View>
              }
            />
          )}
        </View>

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
          <View style={styles.offerBar}>
            <View style={styles.offerBarInfo}>
              <Ionicons name="pricetag" size={16} color={colors.primary} />
              <View style={styles.flex}>
                <Text style={styles.offerBarLabel}>
                  {liveOffer.mine
                    ? "Your offer"
                    : `${participantName.split(" ")[0]}'s offer`}
                </Text>
                <Text style={styles.offerBarAmount} numberOfLines={1}>
                  {formatMoney(liveOffer.amount, liveOffer.currency)}
                </Text>
              </View>
            </View>
            {liveOffer.mine ? (
              <Text style={styles.offerBarWaiting}>Waiting…</Text>
            ) : (
              <View style={styles.offerBarActions}>
                <Pressable
                  onPress={() => void handleDeclineOffer(liveOffer.offerId)}
                  disabled={!!offerPending}
                  style={[styles.offerBarBtn, styles.offerBarBtnGhost]}
                  accessibilityRole="button"
                  accessibilityLabel="Decline offer"
                >
                  {offerPending === `reject:${liveOffer.offerId}` ? (
                    <ActivityIndicator size="small" color={colors.danger} />
                  ) : (
                    <Text style={styles.offerBarBtnGhostText}>Decline</Text>
                  )}
                </Pressable>
                <Pressable
                  onPress={handleOpenOfferComposer}
                  disabled={!!offerPending}
                  style={[styles.offerBarBtn, styles.offerBarBtnOutline]}
                  accessibilityRole="button"
                  accessibilityLabel="Counter offer"
                >
                  <Text style={styles.offerBarBtnOutlineText}>Counter</Text>
                </Pressable>
                <Pressable
                  onPress={() => void handleAcceptOffer(liveOffer.offerId)}
                  disabled={!!offerPending}
                  style={[styles.offerBarBtn, styles.offerBarBtnPrimary]}
                  accessibilityRole="button"
                  accessibilityLabel="Accept offer"
                >
                  {offerPending === `accept:${liveOffer.offerId}` ? (
                    <ActivityIndicator size="small" color={colors.white} />
                  ) : (
                    <Text style={styles.offerBarBtnPrimaryText}>Accept</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>
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
          <View style={[styles.composerWrap, { paddingBottom: composerBottomPad }]}>
            {pendingFile ? (
              <View style={[styles.previewRow, uploadFailed && styles.previewRowFailed]}>
                {previewUri ? (
                  <Image source={{ uri: previewUri }} style={styles.previewThumb} />
                ) : (
                  <View style={styles.previewFile}>
                    <Ionicons
                      name="document-text-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                )}
                <View style={styles.previewBody}>
                  <Text style={styles.previewName} numberOfLines={1}>
                    {pendingFile.name}
                  </Text>
                  <Text
                    style={[
                      styles.previewType,
                      uploadFailed && { color: colors.danger, fontWeight: "700" },
                    ]}
                  >
                    {uploadFailed
                      ? "Upload failed — tap retry"
                      : uploading
                        ? "Uploading…"
                        : pendingFile.type}
                  </Text>
                </View>
                {uploadFailed ? (
                  <Pressable
                    onPress={handleRetryUpload}
                    hitSlop={6}
                    style={styles.previewRetryButton}
                    accessibilityRole="button"
                    accessibilityLabel="Retry upload"
                  >
                    <Ionicons name="refresh" size={18} color={colors.white} />
                  </Pressable>
                ) : null}
                <Pressable
                  onPress={clearPending}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel="Remove attachment"
                >
                  <Ionicons name="close-circle" size={22} color={colors.mutedText} />
                </Pressable>
              </View>
            ) : null}
            <View style={styles.composerRow}>
              {/*
                The make-offer entry point lives on the workflow pin's "Offer" CTA
                and the live-offer bar, so the composer price-tag icon was a
                redundant third way in — removed to keep the composer clean.
              */}
              <Pressable
                onPress={() => setAttachMenuOpen(true)}
                style={styles.composerIconButton}
                accessibilityRole="button"
                accessibilityLabel="Attach"
                disabled={uploading}
              >
                <Ionicons name="attach" size={22} color={colors.mutedText} />
              </Pressable>
              <Pressable
                onPress={() => setEmojiOpen(true)}
                style={styles.composerIconButton}
                accessibilityRole="button"
                accessibilityLabel="Insert emoji"
                disabled={uploading}
              >
                <Ionicons name="happy" size={22} color={colors.mutedText} />
              </Pressable>
              <TextInput
                value={draft}
                onChangeText={handleDraftChange}
                onBlur={stopTyping}
                placeholder={uploading ? "Uploading…" : "Type a message"}
                placeholderTextColor={colors.subtleText}
                style={styles.composerInput}
                multiline
                editable={!uploading}
              />
              <Pressable
                onPress={() => void handleSend()}
                disabled={uploading || (!draft.trim() && !pendingFile)}
                style={[
                  styles.sendButton,
                  (uploading || (!draft.trim() && !pendingFile)) && styles.sendButtonDisabled,
                ]}
                accessibilityRole="button"
                accessibilityLabel="Send"
              >
                {uploading ? (
                  <ActivityIndicator size="small" color={colors.white} />
                ) : (
                  <Ionicons name="send" size={16} color={colors.white} />
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>

      {/* ───────── Attach sheet (composer paperclip) ───────── */}
      <Modal
        visible={attachMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setAttachMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setAttachMenuOpen(false)} />
        <View style={styles.actionSheet}>
          <Text style={styles.actionSheetTitle}>Attach</Text>
          <ActionRow icon="image" label="Send a photo" onPress={handlePickImage} />
          <ActionRow icon="camera-outline" label="Take a photo" onPress={handleTakePhoto} />
          <ActionRow
            icon="document-attach"
            label="Send a document or video"
            onPress={handlePickDocument}
          />
          <View style={styles.actionDivider} />
          <ActionRow icon="close" label="Cancel" onPress={() => setAttachMenuOpen(false)} />
        </View>
      </Modal>

      {/* ───────── Conversation actions sheet (header kebab) ─────────
          Mirrors web's ChatActionDropdown: Match/Decline, View media, Archive,
          Report user, Raise dispute, Block/Unblock, Unmatch. */}
      <Modal
        visible={actionMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActionMenuOpen(false)} />
        <View style={[styles.actionSheet, styles.actionSheetTall]}>
          <Text style={styles.actionSheetTitle}>Chat actions</Text>
          <ScrollView showsVerticalScrollIndicator={false}>
            {matchStatus === "pending" || matchStatus === "declined" ? (
              <ActionRow
                icon="checkmark-circle"
                label={matchStatus === "declined" ? "Match again" : "Send match request"}
                onPress={() => {
                  setActionMenuOpen(false);
                  setMatchModalOpen(true);
                }}
              />
            ) : null}
            {matchStatus === "pending" ? (
              <ActionRow
                icon="close-circle"
                label="Decline match"
                tone="danger"
                onPress={() => {
                  setActionMenuOpen(false);
                  setDeclineOpen(true);
                }}
              />
            ) : null}
            {matchStatus === "pending" || matchStatus === "declined" ? (
              <View style={styles.actionDivider} />
            ) : null}

            <ActionRow
              icon="images-outline"
              label="View media"
              onPress={() => {
                setActionMenuOpen(false);
                setMediaOpen(true);
              }}
            />
            <ActionRow
              icon={isArchived ? "arrow-undo-outline" : "archive-outline"}
              label={
                archivePending
                  ? "Working…"
                  : isArchived
                    ? "Unarchive chat"
                    : "Archive chat"
              }
              onPress={handleArchiveToggle}
            />
            <ActionRow
              icon="flag-outline"
              label="Report user"
              onPress={() => {
                setActionMenuOpen(false);
                setReportUserOpen(true);
              }}
            />
            <ActionRow icon="scale-outline" label="Raise dispute" onPress={handleRaiseDispute} />

            {isBlocked ? (
              <ActionRow icon="checkmark-circle" label="Unblock user" onPress={handleUnblock} />
            ) : (
              <ActionRow icon="ban" label="Block user" tone="danger" onPress={handleBlock} />
            )}
            {matchStatus === "matched" ? (
              <ActionRow icon="link" label="Unmatch" tone="danger" onPress={handleUnmatch} />
            ) : null}

            <View style={styles.actionDivider} />
            <ActionRow icon="close" label="Cancel" onPress={() => setActionMenuOpen(false)} />
          </ScrollView>
        </View>
      </Modal>

      {/* ───────── Bubble long-press menu ───────── */}
      <Modal
        visible={!!bubbleMenu}
        transparent
        animationType="fade"
        onRequestClose={() => setBubbleMenu(null)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setBubbleMenu(null)} />
        <View style={styles.actionSheet}>
          <Text style={styles.actionSheetTitle}>Message</Text>
          {bubbleMenu?.text && bubbleMenu.text !== "📎 Attachment" ? (
            <ActionRow
              icon="copy"
              label="Copy text"
              onPress={() => void handleCopyText()}
            />
          ) : null}
          <ActionRow
            icon="flag"
            label="Report message"
            tone="danger"
            onPress={handleOpenReport}
          />
          <View style={styles.actionDivider} />
          <ActionRow icon="close" label="Cancel" onPress={() => setBubbleMenu(null)} />
        </View>
      </Modal>

      {/* ───────── Expanded image preview ───────── */}
      <Modal
        visible={!!expandedImageUrl}
        transparent
        animationType="fade"
        onRequestClose={() => setExpandedImageUrl(null)}
      >
        <Pressable
          style={styles.imageBackdrop}
          onPress={() => setExpandedImageUrl(null)}
        >
          {expandedImageUrl ? (
            <Image
              source={{ uri: expandedImageUrl }}
              style={styles.expandedImage}
              resizeMode="contain"
            />
          ) : null}
        </Pressable>
        <Pressable
          onPress={() => setExpandedImageUrl(null)}
          style={styles.imageCloseButton}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Close image"
        >
          <Ionicons name="close" size={24} color={colors.white} />
        </Pressable>
      </Modal>

      {/* ───────── Decline-match modal ───────── */}
      <DeclineMatchModal
        open={declineOpen}
        participantName={participantName}
        pending={decliningPending}
        matchRequestFromOther={matchedByOther}
        onCancel={() => {
          if (!decliningPending) setDeclineOpen(false);
        }}
        onConfirm={(reason) => void handleDeclineConfirm(reason)}
      />

      {/* ───────── Report message modal (per-message, long-press) ───────── */}
      <ReportMessageModal
        open={!!reportTarget}
        pending={reportPending}
        onCancel={() => {
          if (!reportPending) setReportTarget(null);
        }}
        onSubmit={(input) => void handleSubmitReport(input)}
      />

      {/* ───────── Report user modal (conversation-level, from actions) ───────── */}
      <ReportMessageModal
        open={reportUserOpen}
        pending={reportUserPending}
        title={`Report ${participantName.split(" ")[0]}`}
        subtitle="Help us keep Safarly safe. Our trust & safety team reviews every report."
        onCancel={() => {
          if (!reportUserPending) setReportUserOpen(false);
        }}
        onSubmit={(input) => void handleSubmitUserReport(input)}
      />

      {/* ───────── Shared media gallery ───────── */}
      <MediaGalleryModal
        open={mediaOpen}
        conversationId={conversationId}
        onClose={() => setMediaOpen(false)}
      />

      {/* ───────── Block / Unmatch confirmation ───────── */}
      <ConfirmActionModal
        open={!!confirmAction}
        title={
          confirmAction === "block" ? `Block ${participantName}?` : "Unmatch?"
        }
        body={
          confirmAction === "block"
            ? "They won't be able to message you. You can unblock from this menu later."
            : "This conversation will revert to pending. Either side can request a new match anytime."
        }
        confirmLabel={confirmAction === "block" ? "Block" : "Unmatch"}
        icon={confirmAction === "block" ? "ban" : "link"}
        tone="destructive"
        pending={confirmPending}
        onCancel={() => {
          if (!confirmPending) setConfirmAction(null);
        }}
        onConfirm={() => void handleConfirmAction()}
      />

      {/* ───────── Match confirmation modal ───────── */}
      <MatchConfirmationModal
        open={matchModalOpen}
        pending={matchPending}
        userRole={userRole}
        contextType={conversation?.context_type}
        onCancel={() => {
          if (!matchPending) setMatchModalOpen(false);
        }}
        onConfirm={() => void handleAccept()}
      />

      {/* ───────── Travel-document verification modal ───────── */}
      <TravelDocModal
        open={travelDocOpen}
        doc={travelDoc.doc}
        loading={travelDoc.loading}
        pending={travelDoc.pending}
        onClose={() => setTravelDocOpen(false)}
        onUpload={(file) => void handleDocUpload(file)}
        onApprove={() => void handleDocApprove()}
        onReject={(reason) => void handleDocReject(reason)}
        onRequestAdminReview={() => void handleDocAdminReview()}
        onCancelMatch={() => void handleDocCancelMatch()}
      />

      {/* ───────── Parcel-photo review modal ───────── */}
      <ParcelReviewModal
        open={parcelReviewOpen}
        review={parcelReview.review}
        loading={parcelReview.loading}
        pending={parcelReview.pending}
        onClose={() => setParcelReviewOpen(false)}
        onUpload={(files) => void handleParcelUpload(files)}
        onApprove={() => void handleParcelApprove()}
        onReject={(reason, note) => void handleParcelReject(reason, note)}
        onCancelRequest={() => void handleParcelCancel()}
      />

      {/* ───────── Offer composer modal ───────── */}
      <OfferComposerModal
        open={!!offerComposer}
        mode={offerComposer?.mode ?? "seed"}
        pending={offerPending === "seed" || offerPending === "counter"}
        currentAmount={offerComposer?.mode === "counter" ? liveOffer?.amount ?? null : null}
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

// ───────────────────────── Bubble ─────────────────────────

// ───────────────────────── Typed message bubbles ─────────────────────────
// Mirrors the server's `message_kind` discriminator (see
// `MOBILE_IMPLEMENTATION_GUIDE.md` §10: chat is the source of truth for offer
// state). Kinds are optional on the wire today — when missing we fall back to
// a plain text bubble so older threads keep rendering.

function formatMoney(amount?: number, currency?: string): string {
  if (typeof amount !== "number") return "";
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${amount.toFixed(2)}`;
}

interface OfferCardBubbleProps {
  payload: OfferCardPayload;
  mine: boolean;
  time: string;
  status: OfferStatus;
  actions?: OfferCardActions;
}

/** Per-status presentation for the offer card badge + accents. */
const OFFER_STATUS_META: Record<
  OfferStatus,
  { label: string; icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string }
> = {
  open: { label: "Open offer", icon: "pricetag", fg: colors.primary, bg: colors.surfaceTintPrimary },
  accepted: {
    label: "Accepted",
    icon: "checkmark-circle",
    fg: colors.safe,
    bg: "rgba(34,195,93,0.14)",
  },
  rejected: { label: "Declined", icon: "close-circle", fg: colors.danger, bg: "rgba(220,40,40,0.10)" },
  expired: { label: "Expired", icon: "time-outline", fg: colors.subtleText, bg: colors.surfaceMuted },
  superseded: {
    label: "Superseded",
    icon: "swap-horizontal",
    fg: colors.subtleText,
    bg: colors.surfaceMuted,
  },
};

function OfferCardBubble({ payload, mine, time, status, actions }: Readonly<OfferCardBubbleProps>) {
  const isClosed = status === "rejected" || status === "expired" || status === "superseded";
  const isOpen = status === "open";
  const meta = OFFER_STATUS_META[status] ?? OFFER_STATUS_META.open;
  const busy = !!actions && (actions.acceptPending || actions.rejectPending);

  return (
    <View style={[styles.offerCardRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View
        style={[
          styles.offerCard,
          isOpen && styles.offerCardOpen,
          status === "accepted" && styles.offerCardAccepted,
          isClosed && styles.offerCardClosed,
        ]}
      >
        <View style={[styles.offerBadge, { backgroundColor: meta.bg }]}>
          <Ionicons name={meta.icon} size={12} color={meta.fg} />
          <Text style={[styles.offerBadgeText, { color: meta.fg }]}>{meta.label}</Text>
        </View>

        <Text
          style={[
            styles.offerCardAmount,
            isClosed && styles.offerCardAmountClosed,
            status === "superseded" && styles.offerCardAmountStruck,
          ]}
        >
          {formatMoney(payload.amount, payload.currency)}
        </Text>

        {payload.note ? (
          <Text style={styles.offerCardNote} numberOfLines={3}>
            {payload.note}
          </Text>
        ) : null}

        <Text style={styles.offerCardFooter}>
          {payload.proposer_name ? `${payload.proposer_name} · ` : ""}
          {time}
        </Text>

        {actions ? (
          <View style={styles.offerCardActions}>
            {/* Primary action gets its own full-width row so it's unmissable;
                the two secondary choices sit below with equal weight. */}
            <Pressable
              onPress={actions.onAccept}
              disabled={busy}
              style={[styles.offerActionBtn, styles.offerActionAccept]}
              accessibilityRole="button"
              accessibilityLabel="Accept offer"
            >
              {actions.acceptPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={18} color={colors.white} />
                  <Text style={styles.offerActionAcceptText}>Accept offer</Text>
                </>
              )}
            </Pressable>
            <View style={styles.offerActionSecondaryRow}>
              <Pressable
                onPress={actions.onCounter}
                disabled={busy}
                style={[styles.offerActionBtn, styles.offerActionSecondary, styles.offerActionCounter]}
                accessibilityRole="button"
                accessibilityLabel="Counter offer"
              >
                <Ionicons name="swap-horizontal" size={16} color={colors.text} />
                <Text style={styles.offerActionCounterText} numberOfLines={1}>
                  Counter
                </Text>
              </Pressable>
              <Pressable
                onPress={actions.onDecline}
                disabled={busy}
                style={[styles.offerActionBtn, styles.offerActionSecondary, styles.offerActionDecline]}
                accessibilityRole="button"
                accessibilityLabel="Decline offer"
              >
                {actions.rejectPending ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <>
                    <Ionicons name="close" size={16} color={colors.danger} />
                    <Text style={styles.offerActionDeclineText} numberOfLines={1}>
                      Decline
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
}

interface SystemRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "neutral" | "good" | "bad";
  onPress?: () => void;
}

/**
 * Centered status line between messages — the standard chat treatment for
 * system events (WhatsApp/Telegram-style), rather than a message bubble.
 *
 * Deliberately understated: these are context, not conversation. Previously
 * each rendered as a bold pill with a generic info icon AND a chevron, which
 * gave a run of them the look of a settings list rather than a chat, and long
 * server text turned the pill into a full-width grey block. The chevron in
 * particular appeared on every row, so it signalled nothing.
 */
function SystemRow({ icon, text, tone = "neutral", onPress }: Readonly<SystemRowProps>) {
  // `subtleText` (#3A3548), not `mutedText` (#14121C) — the latter is near-black
  // and would make these asides heavier than the messages around them.
  const toneColor =
    tone === "good" ? colors.safe : tone === "bad" ? colors.danger : colors.subtleText;

  const body = (
    <View style={styles.systemPill}>
      {/* Icon only where it carries meaning — a neutral update needs no glyph. */}
      {tone !== "neutral" ? (
        <Ionicons name={icon} size={12} color={toneColor} style={styles.systemIcon} />
      ) : null}
      <Text style={[styles.systemPillText, { color: toneColor }]}>{text}</Text>
    </View>
  );

  return (
    <View style={styles.systemRow}>
      {onPress ? (
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={text}>
          {body}
        </Pressable>
      ) : (
        body
      )}
    </View>
  );
}

interface MessageBubbleProps {
  message: DisplayMessage;
  mine: boolean;
  offer?: OfferRenderState;
  onRetry: () => void;
  onDiscard: () => void;
  onOpenImage: (url: string) => void;
  onLongPress: (message: DisplayMessage) => void;
  onSystemPress: (bookingId: string) => void;
}

const SYSTEM_EVENT_LABELS: Record<string, string> = {
  match_confirmed: "Match confirmed",
  travel_date_confirmed: "Travel date confirmed",
  payment_received: "Payment received",
  payment_pending: "Payment pending",
  handoff_accepted: "Handoff accepted",
  handoff_rejected: "Handoff rejected",
  cancelled: "Booking cancelled",
  delivered: "Delivered",
};

function MessageBubble({
  message,
  mine,
  offer,
  onRetry,
  onDiscard,
  onOpenImage,
  onLongPress,
  onSystemPress,
}: Readonly<MessageBubbleProps>) {
  const time = formatBubbleTime(message.created_at);
  const kind = message.message_kind ?? "text";
  const payload = message.payload ?? null;

  if (kind === "offer_card") {
    const p = (payload as OfferCardPayload | null) ?? ({} as OfferCardPayload);
    return (
      <OfferCardBubble
        payload={p}
        mine={mine}
        time={time}
        status={offer?.status ?? p.status ?? "open"}
        actions={offer?.actions}
      />
    );
  }
  if (kind === "offer_accept") {
    const p = (payload as OfferAcceptPayload | null) ?? null;
    const money = formatMoney(p?.amount, p?.currency);
    return (
      <SystemRow
        icon="checkmark-circle"
        tone="good"
        text={money ? `Offer accepted at ${money}` : "Offer accepted"}
      />
    );
  }
  if (kind === "offer_reject") {
    return <SystemRow icon="close-circle" tone="bad" text="Offer declined" />;
  }
  if (kind === "system_event") {
    const p = (payload as SystemEventPayload | null) ?? null;
    // Concise label for known events; else the server's human text, else "Update".
    const mapped = p?.event ? SYSTEM_EVENT_LABELS[p.event] : undefined;
    const label = mapped ?? (message.text?.trim() || p?.event || "Update");
    const tone: SystemRowProps["tone"] =
      p?.event === "delivered" ||
      p?.event === "payment_received" ||
      p?.event === "match_confirmed" ||
      p?.event === "travel_date_confirmed"
        ? "good"
        : p?.event === "cancelled" || p?.event === "handoff_rejected"
          ? "bad"
          : "neutral";
    return (
      <SystemRow
        // Only rendered for good/bad tones, so it reads as an outcome rather
        // than decorating every neutral update with a generic info glyph.
        icon={tone === "good" ? "checkmark-circle" : "alert-circle"}
        tone={tone}
        text={label}
        onPress={p?.booking_id ? () => onSystemPress(p.booking_id as string) : undefined}
      />
    );
  }

  const failed = message._clientStatus === "failed";
  const pending = message._clientStatus === "pending";
  const showText = message.text && message.text !== "📎 Attachment";

  return (
    <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <Pressable
        onLongPress={() => onLongPress(message)}
        delayLongPress={350}
        style={[
          styles.bubble,
          mine ? styles.bubbleMine : styles.bubbleTheirs,
          failed && styles.bubbleFailed,
        ]}
        accessibilityRole="text"
        accessibilityHint="Long-press for message options"
      >
        {message.attachment_url ? (
          <Attachment
            url={message.attachment_url}
            type={message.attachment_type ?? ""}
            onOpenImage={onOpenImage}
          />
        ) : null}
        {showText ? (
          <Text style={[styles.bubbleText, mine ? styles.bubbleTextMine : styles.bubbleTextTheirs]}>
            {message.text}
          </Text>
        ) : null}
        <View style={styles.bubbleFooter}>
          <Text style={[styles.bubbleTime, mine ? styles.bubbleTimeMine : styles.bubbleTimeTheirs]}>
            {time}
          </Text>
          {mine ? (
            failed ? (
              <Ionicons name="alert-circle" size={11} color={colors.danger} />
            ) : pending ? (
              <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.65)" />
            ) : message.read_at ? (
              // Web parity: double check rendered bright when the other side has read it.
              <Ionicons name="checkmark-done" size={13} color="#7AD7FF" />
            ) : (
              // Sent + delivered (server has it) but not yet read: muted single check.
              <Ionicons name="checkmark" size={13} color="rgba(255,255,255,0.85)" />
            )
          ) : null}
        </View>
      </Pressable>
      {failed ? (
        <View style={styles.failedActionsRow}>
          <Pressable onPress={onRetry} hitSlop={4} accessibilityRole="button" accessibilityLabel="Retry send">
            <Text style={styles.failedAction}>Retry</Text>
          </Pressable>
          <Text style={styles.failedSep}>·</Text>
          <Pressable
            onPress={onDiscard}
            hitSlop={4}
            accessibilityRole="button"
            accessibilityLabel="Discard message"
          >
            <Text style={styles.failedAction}>Discard</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  );
}

// ───────────────────────── Attachment ─────────────────────────

interface AttachmentProps {
  url: string;
  type: string;
  onOpenImage: (url: string) => void;
}

function Attachment({ url, type, onOpenImage }: Readonly<AttachmentProps>) {
  if (type.startsWith("image/")) {
    return (
      <Pressable
        onPress={() => onOpenImage(url)}
        accessibilityRole="image"
        accessibilityLabel="Tap to expand"
      >
        <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
      </Pressable>
    );
  }
  const fileName = type.includes("pdf")
    ? "PDF Document"
    : type.includes("word")
      ? "Word Document"
      : type.startsWith("video/")
        ? "Video"
        : "Document";
  const icon: keyof typeof Ionicons.glyphMap = type.startsWith("video/")
    ? "videocam"
    : type.includes("pdf")
      ? "document-text-outline"
      : "document-attach";
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={styles.attachmentDocCard}
      accessibilityRole="button"
      accessibilityLabel={`Open ${fileName}`}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.attachmentDocName}>{fileName}</Text>
      <Ionicons name="open" size={14} color={colors.mutedText} />
    </Pressable>
  );
}

// ───────────────────────── Action sheet row ─────────────────────────

function ActionRow({
  icon,
  label,
  onPress,
  tone,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "danger";
}>) {
  return (
    <Pressable onPress={onPress} style={styles.actionRow} accessibilityRole="button">
      <Ionicons name={icon} size={20} color={tone === "danger" ? colors.danger : colors.text} />
      <Text style={[styles.actionLabel, tone === "danger" && { color: colors.danger }]}>
        {label}
      </Text>
    </Pressable>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  flex: { flex: 1 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  // Avatar + name/subtitle — one tap target that opens the profile, sitting
  // between the back button and the kebab.
  headerIdentity: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10, minWidth: 0 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  headerAvatarImage: { width: 36, height: 36, borderRadius: 18 },
  headerAvatarText: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, minWidth: 0 },
  headerTitle: { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  headerStatusPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 999,
  },
  headerStatusText: {
    fontSize: 9,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  headerSubtitle: { fontSize: 11, fontWeight: "700", marginTop: 2 },
  subtitleRow: { flexDirection: "row", alignItems: "center" },

  // Banners
  banner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  bannerWarning: { backgroundColor: "rgba(245, 158, 11, 0.10)" },
  // Dashed-orange variant for "waiting on the other side" — matches web's
  // distinct treatment for the awaitingOtherAccept state.
  bannerWaiting: {
    backgroundColor: "rgba(245, 158, 11, 0.08)",
    borderStyle: "dashed",
    borderTopWidth: 1,
    borderTopColor: colors.warning,
    borderBottomColor: colors.warning,
  },
  bannerMuted: { backgroundColor: colors.surfaceMuted },
  bannerDanger: { backgroundColor: "rgba(239, 68, 68, 0.10)" },
  bannerTextWrap: { flex: 1 },
  bannerTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  bannerBody: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  bannerActions: { flexDirection: "row", gap: 6 },
  bannerButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  bannerButtonPrimary: { backgroundColor: colors.safe },
  bannerButtonPrimaryText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  bannerButtonOutline: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  bannerButtonOutlineText: { color: colors.text, fontSize: 11, fontWeight: "800" },

  // List
  // gap 2 (not 8): rows carry their own margins, so consecutive bubbles sit ~6px
  // apart and system asides ~14px — the tighter grouping messaging apps use.
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, gap: 2 },
  listContentEmpty: { flexGrow: 1, justifyContent: "center" },

  // Top "loading older messages" spinner (WhatsApp-style, auto-load on scroll-up)
  loadOlderSpinner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },

  // Bubble
  bubbleRow: { width: "100%", marginBottom: 4 },
  bubbleRowMine: { alignItems: "flex-end" },
  bubbleRowTheirs: { alignItems: "flex-start" },
  bubble: {
    maxWidth: "78%",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 4,
  },
  bubbleMine: { backgroundColor: colors.primary, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: 4,
  },
  bubbleFailed: { borderColor: colors.danger, borderWidth: 1 },
  bubbleText: { fontSize: 14, lineHeight: 18 },
  bubbleTextMine: { color: colors.white },
  bubbleTextTheirs: { color: colors.text },
  bubbleFooter: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-end" },
  bubbleTime: { fontSize: 10, fontWeight: "600" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
  bubbleTimeTheirs: { color: colors.subtleText },
  failedActionsRow: { flexDirection: "row", gap: 6, marginTop: 4, alignItems: "center" },
  failedAction: { color: colors.danger, fontSize: 11, fontWeight: "800" },
  failedSep: { color: colors.mutedText, fontSize: 11 },

  // Attachments
  attachmentImage: {
    width: 200,
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  attachmentDocCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
  },
  attachmentDocName: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 },

  // Composer
  composerWrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    // paddingBottom is applied inline from the safe-area inset.
    gap: 8,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 8,
  },
  previewRowFailed: {
    backgroundColor: "rgba(220, 40, 40, 0.08)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  previewRetryButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  previewThumb: { width: 40, height: 40, borderRadius: 6 },
  previewFile: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  previewBody: { flex: 1, minWidth: 0 },
  previewName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  previewType: { color: colors.mutedText, fontSize: 11 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },

  // Centered states
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24, gap: 10 },
  emptyIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
    marginBottom: 4,
  },
  centeredTitle: { color: colors.text, fontSize: 15, fontWeight: "800" },
  centeredBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.ctaAccent,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },

  // Action sheet
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  actionSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingBottom: 24,
    paddingHorizontal: 8,
  },
  // The conversation-actions sheet has more rows; cap it and let it scroll on
  // short screens so Cancel is always reachable.
  actionSheetTall: { maxHeight: "82%" },
  actionSheetTitle: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  actionRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  actionLabel: { color: colors.text, fontSize: 15, fontWeight: "600" },
  actionDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 14,
    marginVertical: 4,
  },

  // Expanded image
  imageBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandedImage: { width: "100%", height: "100%" },
  imageCloseButton: {
    position: "absolute",
    top: 48,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },

  // Typed bubbles — offer cards & system events
  offerCardRow: { flexDirection: "row", paddingHorizontal: 14, marginVertical: 4 },
  offerCard: {
    maxWidth: "92%",
    minWidth: 240,
    backgroundColor: colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 8,
    // Soft lift so an actionable offer reads as a card, not another bubble.
    shadowColor: "#1B1330",
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 1,
  },
  offerCardOpen: { borderColor: "rgba(93, 63, 211, 0.30)" },
  // Accepted is a terminal record, so it sits flat like the closed cards — but
  // with a green accent. The fill MUST be opaque: a translucent background under
  // the base card's elevation makes Android paint a grey box behind it.
  offerCardAccepted: {
    borderColor: "rgba(34,195,93,0.45)",
    backgroundColor: "#EAF7EF",
    shadowOpacity: 0,
    elevation: 0,
  },
  // Closed offers (superseded / expired / declined) recede: clean white card,
  // no lift, tighter — a quiet record rather than a live card. They stay white
  // (not the muted fill) so they don't blend into the lavender chat surface.
  offerCardClosed: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    gap: 5,
    paddingVertical: 10,
    shadowOpacity: 0,
    elevation: 0,
  },
  offerBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
  },
  offerBadgeText: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  offerCardAmount: {
    color: colors.text,
    fontSize: 26,
    fontWeight: "800",
    letterSpacing: 0.2,
  },
  offerCardAmountClosed: { fontSize: 19, color: colors.mutedText },
  offerCardAmountStruck: { textDecorationLine: "line-through" },
  offerCardNote: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  offerCardFooter: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  offerCardActions: {
    gap: 8,
    marginTop: 6,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  offerActionSecondaryRow: { flexDirection: "row", gap: 8 },
  offerActionBtn: {
    height: 46,
    borderRadius: 12,
    flexDirection: "row",
    gap: 6,
    alignItems: "center",
    justifyContent: "center",
  },
  // Primary — full width, solid, lifted so it clearly leads.
  offerActionAccept: {
    backgroundColor: colors.safe,
    shadowColor: colors.safe,
    shadowOpacity: 0.25,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  offerActionAcceptText: { color: colors.white, fontSize: 15, fontWeight: "800" },
  // Secondary — equal-width, bordered so they read as real buttons, not text.
  // `minWidth: 0` + `flexShrink` on the label keep the text inside the button
  // instead of spilling past the border on a narrow card.
  offerActionSecondary: {
    flex: 1,
    minWidth: 0,
    paddingHorizontal: 8,
    borderWidth: 1,
    backgroundColor: colors.card,
  },
  offerActionCounter: { borderColor: colors.border },
  offerActionCounterText: { color: colors.text, fontSize: 14, fontWeight: "800", flexShrink: 1 },
  offerActionDecline: { borderColor: "rgba(220, 40, 40, 0.35)" },
  offerActionDeclineText: { color: colors.danger, fontSize: 14, fontWeight: "800", flexShrink: 1 },

  // Offer bar (above the composer)
  offerBar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 10,
    backgroundColor: colors.surfaceTintPrimary,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  offerBarInfo: { flexDirection: "row", alignItems: "center", gap: 8, flex: 1, minWidth: 0 },
  offerBarLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700" },
  offerBarAmount: { color: colors.text, fontSize: 16, fontWeight: "800" },
  offerBarWaiting: { color: colors.mutedText, fontSize: 12, fontWeight: "700", fontStyle: "italic" },
  offerBarActions: { flexDirection: "row", gap: 6 },
  offerBarBtn: {
    paddingHorizontal: 12,
    minWidth: 64,
    height: 32,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  offerBarBtnGhost: { backgroundColor: "transparent" },
  offerBarBtnGhostText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  offerBarBtnOutline: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.card },
  offerBarBtnOutlineText: { color: colors.text, fontSize: 12, fontWeight: "800" },
  offerBarBtnPrimary: { backgroundColor: colors.safe },
  offerBarBtnPrimaryText: { color: colors.white, fontSize: 12, fontWeight: "800" },

  // Offer feedback banner wrap
  offerBannerWrap: { paddingHorizontal: 14, paddingTop: 10 },

  systemRow: {
    alignItems: "center",
    justifyContent: "center",
    // Generous side padding keeps a long status from spanning the full width,
    // so it reads as a centered aside rather than another message.
    paddingHorizontal: 44,
    marginVertical: 6,
  },
  systemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    // Translucent rather than a solid fill: these sit between bubbles and
    // shouldn't compete with them for weight.
    backgroundColor: "rgba(8, 7, 13, 0.05)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  systemIcon: { marginTop: 1 },
  systemPillText: {
    fontSize: 12,
    lineHeight: 17,
    fontWeight: "500",
    textAlign: "center",
    // Lets a long status wrap inside the pill instead of forcing it wider.
    flexShrink: 1,
  },
});
