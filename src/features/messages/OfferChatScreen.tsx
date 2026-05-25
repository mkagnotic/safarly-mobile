import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useFocusEffect, useNavigation, useRoute } from "@react-navigation/native";
import * as Clipboard from "expo-clipboard";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  BackHandler,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
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
import { Screen } from "@/components/ui/Screen";
import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { DeclineMatchModal } from "@/components/chat/DeclineMatchModal";
import { DeliveryHistoryModal } from "@/components/chat/DeliveryHistoryModal";
import {
  MatchConfirmationModal,
  type MatchUserRole,
} from "@/components/chat/MatchConfirmationModal";
import { ReportMessageModal } from "@/components/chat/ReportMessageModal";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useChatMessages, type DisplayMessage } from "@/hooks/api/useChatMessages";
import { useMyConversations } from "@/hooks/api/useMyConversations";
import { useConversationPresence } from "@/hooks/realtime/useConversationPresence";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, messagesApi, type Conversation, type RNUploadFile } from "@/services/api";
import { colors } from "@/theme/colors";

type ChatNav = BottomTabNavigationProp<MainTabParamList, "OfferChatTab">;
type ChatRoute = RouteProp<MainTabParamList, "OfferChatTab">;

/** 10 MB — same cap as web (`MAX_FILE_SIZE` in CustomerMessages). */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

function getBackTarget(source: "home" | "offers" | "messages" | "buddies") {
  switch (source) {
    case "home":
      return "Home" as const;
    case "messages":
      return "MessagesTab" as const;
    case "buddies":
      return "Buddies" as const;
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

  const conversationId = route.params?.conversationId ?? null;
  const fallbackName = route.params?.name ?? "Conversation";
  const source = route.params?.source ?? "offers";
  const fallbackBackTarget = getBackTarget(source);

  const { conversations, acceptMatch, declineMatch } = useMyConversations({
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
  const wasUnmatched =
    matchStatus === "pending" &&
    !conversation?.matched_by &&
    (!!conversation?.matched_at || !!conversation?.last_message_at);
  const isDeclined = matchStatus === "declined";
  // Web parity: "ever matched" is the union of currently-matched + previously-
  // matched-and-now-something-else. Drives the "Delivery history" affordance
  // so users can review past deliveries even after a decline / unmatch.
  const hasBeenMatched = matchStatus === "matched" || !!conversation?.matched_at;
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

  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<RNUploadFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // Tracks whether the LAST send attempt for `pendingFile` failed, so the
  // composer preview row can show a retry icon (web parity:
  // CustomerMessages.tsx:905-908). Cleared whenever a new file is picked or
  // a send succeeds.
  const [uploadFailed, setUploadFailed] = useState(false);
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  const [expandedImageUrl, setExpandedImageUrl] = useState<string | null>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [declineOpen, setDeclineOpen] = useState(false);
  const [decliningPending, setDecliningPending] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [matchModalOpen, setMatchModalOpen] = useState(false);
  const [matchPending, setMatchPending] = useState(false);
  const [reportTarget, setReportTarget] = useState<DisplayMessage | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<DisplayMessage | null>(null);
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
    setActionMenuOpen(false);
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
    setActionMenuOpen(false);
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
    setActionMenuOpen(false);
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
      void refetch();
    } catch (err) {
      showToast({
        title: confirmAction === "block" ? "Couldn't block" : "Couldn't unmatch",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setConfirmPending(false);
    }
  }, [conversationId, confirmAction, refetch]);

  const handleUnblock = useCallback(async () => {
    if (!conversationId) return;
    setActionMenuOpen(false);
    try {
      await messagesApi.unblockUser(conversationId);
      showToast({ title: "Unblocked", variant: "info" });
      void refetch();
    } catch (err) {
      showToast({
        title: "Couldn't unblock",
        message: getErrorMessage(err),
        variant: "error",
      });
    }
  }, [conversationId, refetch]);

  const handleDeliveryHistory = useCallback(() => {
    setActionMenuOpen(false);
    setHistoryOpen(true);
  }, []);

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

  const renderMessage = useCallback(
    ({ item }: ListRenderItemInfo<DisplayMessage>) => {
      const mine = item.sender_id === user?.id || item.from_user_id === user?.id;
      return (
        <MessageBubble
          message={item}
          mine={mine}
          onRetry={() => void retry(item._clientId ?? item.id)}
          onDiscard={() => discard(item._clientId ?? item.id)}
          onOpenImage={(url) => setExpandedImageUrl(url)}
          onLongPress={handleBubbleLongPress}
        />
      );
    },
    [user?.id, retry, discard, handleBubbleLongPress],
  );

  const keyExtractor = useCallback((item: DisplayMessage) => item.id, []);

  // ───────── No-conversation guard ─────────
  if (!conversationId) {
    return (
      <Screen scroll={false} edges={["top", "left", "right"]}>
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
    <Screen scroll={false} edges={["top", "left", "right"]} disableKeyboardAvoiding>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.flex}
      >
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
                hasMore || loadingOlder ? (
                  <Pressable
                    onPress={() => void loadOlder()}
                    disabled={loadingOlder}
                    style={styles.loadOlderButton}
                    accessibilityRole="button"
                    accessibilityLabel="Load older messages"
                  >
                    {loadingOlder ? (
                      <ActivityIndicator size="small" color={colors.primary} />
                    ) : (
                      <Text style={styles.loadOlderText}>Load older messages</Text>
                    )}
                  </Pressable>
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

        {/* ───────── Composer ───────── */}
        {canSend && !matchedByOther ? (
          <View style={styles.composerWrap}>
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
              <Pressable
                onPress={() => setActionMenuOpen(true)}
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
      </KeyboardAvoidingView>

      {/* ───────── Action menu modal ───────── */}
      <Modal
        visible={actionMenuOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setActionMenuOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setActionMenuOpen(false)} />
        <View style={styles.actionSheet}>
          <Text style={styles.actionSheetTitle}>Chat actions</Text>
          <ActionRow icon="image" label="Send a photo" onPress={handlePickImage} />
          <ActionRow icon="camera-outline" label="Take a photo" onPress={handleTakePhoto} />
          <ActionRow
            icon="document-attach"
            label="Send a document or video"
            onPress={handlePickDocument}
          />
          <View style={styles.actionDivider} />
          {/* Web parity (`ChatActionDropdown.tsx:142-160`): "Match" / "Match
              again" available whenever pending or declined; "Delivery history"
              available whenever ever-matched (matched_at set), even if the
              relationship was later declined / unmatched. */}
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
          {matchStatus === "matched" ? (
            <ActionRow icon="link" label="Unmatch" onPress={handleUnmatch} />
          ) : null}
          {hasBeenMatched ? (
            <ActionRow
              icon="cube-outline"
              label="Delivery history"
              onPress={handleDeliveryHistory}
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
          {isBlocked ? (
            <ActionRow
              icon="checkmark-circle"
              label="Unblock user"
              onPress={handleUnblock}
            />
          ) : (
            <ActionRow
              icon="ban"
              label="Block user"
              tone="danger"
              onPress={handleBlock}
            />
          )}
          <View style={styles.actionDivider} />
          <ActionRow
            icon="close"
            label="Cancel"
            onPress={() => setActionMenuOpen(false)}
          />
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

      {/* ───────── Delivery history modal ───────── */}
      <DeliveryHistoryModal
        open={historyOpen}
        conversationId={conversationId}
        onClose={() => setHistoryOpen(false)}
      />

      {/* ───────── Report message modal ───────── */}
      <ReportMessageModal
        open={!!reportTarget}
        pending={reportPending}
        onCancel={() => {
          if (!reportPending) setReportTarget(null);
        }}
        onSubmit={(input) => void handleSubmitReport(input)}
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

type ChatMessageKind =
  | "text"
  | "offer_card"
  | "offer_accept"
  | "offer_reject"
  | "system_event";

interface OfferCardPayload {
  amount?: number;
  currency?: string;
  note?: string | null;
  status?: "open" | "accepted" | "rejected" | "superseded" | "expired";
  proposer_name?: string | null;
}

interface OfferStatusPayload {
  amount?: number;
  currency?: string;
}

interface SystemEventPayload {
  event?: string;
  detail?: string | null;
}

/** Read the optional typed-message fields the server may attach. */
function readTypedMessage(message: DisplayMessage): {
  kind: ChatMessageKind;
  payload: unknown;
} {
  const raw = message as DisplayMessage & {
    message_kind?: ChatMessageKind;
    payload?: unknown;
  };
  return {
    kind: raw.message_kind ?? "text",
    payload: raw.payload ?? null,
  };
}

function formatMoney(amount?: number, currency?: string): string {
  if (typeof amount !== "number") return "";
  const sym = currency === "INR" ? "₹" : "$";
  return `${sym}${amount.toFixed(2)}`;
}

interface OfferCardBubbleProps {
  payload: OfferCardPayload;
  mine: boolean;
  time: string;
}

function OfferCardBubble({ payload, mine, time }: Readonly<OfferCardBubbleProps>) {
  const status = payload.status ?? "open";
  const isClosed = status === "rejected" || status === "expired" || status === "superseded";
  const isAccepted = status === "accepted";
  const statusLabel =
    status === "open"
      ? "Open offer"
      : status === "accepted"
        ? "Accepted"
        : status === "rejected"
          ? "Declined"
          : status === "expired"
            ? "Expired"
            : "Superseded";

  return (
    <View style={[styles.offerCardRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
      <View
        style={[
          styles.offerCard,
          isAccepted && styles.offerCardAccepted,
          isClosed && styles.offerCardClosed,
        ]}
      >
        <View style={styles.offerCardHeader}>
          <Ionicons
            name={
              isAccepted
                ? "checkmark-circle"
                : status === "rejected"
                  ? "close-circle"
                  : status === "expired"
                    ? "time-outline"
                    : "pricetag"
            }
            size={14}
            color={isAccepted ? colors.safe : isClosed ? colors.subtleText : colors.primary}
          />
          <Text
            style={[
              styles.offerCardStatusLabel,
              isAccepted && { color: colors.safe },
              isClosed && { color: colors.subtleText },
            ]}
          >
            {statusLabel}
          </Text>
        </View>
        <Text style={styles.offerCardAmount}>
          {formatMoney(payload.amount, payload.currency)}
        </Text>
        {payload.note ? (
          <Text style={styles.offerCardNote} numberOfLines={3}>
            {payload.note}
          </Text>
        ) : null}
        <Text style={styles.offerCardFooter}>
          {payload.proposer_name ? `${payload.proposer_name} • ` : ""}
          {time}
        </Text>
      </View>
    </View>
  );
}

interface SystemRowProps {
  icon: keyof typeof Ionicons.glyphMap;
  text: string;
  tone?: "neutral" | "good" | "bad";
}

function SystemRow({ icon, text, tone = "neutral" }: Readonly<SystemRowProps>) {
  const toneColor =
    tone === "good" ? colors.safe : tone === "bad" ? colors.danger : colors.subtleText;
  return (
    <View style={styles.systemRow}>
      <View style={styles.systemPill}>
        <Ionicons name={icon} size={12} color={toneColor} />
        <Text style={[styles.systemPillText, { color: toneColor }]}>{text}</Text>
      </View>
    </View>
  );
}

interface MessageBubbleProps {
  message: DisplayMessage;
  mine: boolean;
  onRetry: () => void;
  onDiscard: () => void;
  onOpenImage: (url: string) => void;
  onLongPress: (message: DisplayMessage) => void;
}

function MessageBubble({
  message,
  mine,
  onRetry,
  onDiscard,
  onOpenImage,
  onLongPress,
}: Readonly<MessageBubbleProps>) {
  const time = formatBubbleTime(message.created_at);
  const { kind, payload } = readTypedMessage(message);

  if (kind === "offer_card") {
    return <OfferCardBubble payload={(payload as OfferCardPayload) ?? {}} mine={mine} time={time} />;
  }
  if (kind === "offer_accept") {
    const p = (payload as OfferStatusPayload) ?? {};
    const money = formatMoney(p.amount, p.currency);
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
    const p = (payload as SystemEventPayload) ?? {};
    return <SystemRow icon="information-circle-outline" text={p.detail ?? p.event ?? "Update"} />;
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
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  iconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
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
  listContent: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 16, gap: 8 },
  listContentEmpty: { flexGrow: 1, justifyContent: "center" },

  // "Load older messages" header button
  loadOlderButton: {
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    minWidth: 160,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 32,
  },
  loadOlderText: { color: colors.primary, fontSize: 12, fontWeight: "800" },

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
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    paddingBottom: Platform.OS === "ios" ? 18 : 10,
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
    backgroundColor: colors.primary,
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
    backgroundColor: colors.primary,
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
  offerCardRow: { flexDirection: "row", paddingHorizontal: 14, marginBottom: 8 },
  offerCard: {
    maxWidth: "80%",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    gap: 6,
  },
  offerCardAccepted: {
    borderColor: "rgba(34,195,93,0.45)",
    backgroundColor: "rgba(34,195,93,0.06)",
  },
  offerCardClosed: { opacity: 0.65 },
  offerCardHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  offerCardStatusLabel: {
    color: colors.primary,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  offerCardAmount: {
    color: colors.text,
    fontSize: 22,
    fontWeight: "800",
    letterSpacing: 0.3,
  },
  offerCardNote: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500",
  },
  offerCardFooter: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },

  systemRow: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    marginBottom: 8,
  },
  systemPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  systemPillText: { fontSize: 12, fontWeight: "700" },
});
