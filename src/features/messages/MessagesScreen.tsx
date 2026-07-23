import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useFocusEffect, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { DeclineMatchModal } from "@/components/chat/DeclineMatchModal";
import {
  MatchConfirmationModal,
  type MatchUserRole,
} from "@/components/chat/MatchConfirmationModal";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useMyConversations } from "@/hooks/api/useMyConversations";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage, messagesApi, type Conversation } from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type InboxFilter = "all" | "unread" | "requests";

interface MiniStatus {
  label: string;
  bg: string;
  fg: string;
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

/**
 * "5:30 PM" if today, "Yesterday" if yesterday, else "Mar 18".
 * Mirrors web's `timeLabel` formatting in CustomerMessages.
 */
function formatRowTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const messageDate = new Date(iso);
  if (Number.isNaN(messageDate.getTime())) return "";
  const now = new Date();
  if (messageDate.toDateString() === now.toDateString()) {
    return messageDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (messageDate.toDateString() === yesterday.toDateString()) return "Yesterday";
  return messageDate.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

interface ConversationFlags {
  hasUnread: boolean;
  isMatched: boolean;
  awaitingMine: boolean;
  awaitingTheirs: boolean;
  isDeclined: boolean;
  isBlocked: boolean;
  wasUnmatched: boolean;
}

/**
 * Web parity (`CustomerMessages.tsx:287-291`): for buddy context both sides
 * are senders; for booking, `participant_1` is the sender. Mirrors the same
 * helper in OfferChatScreen.
 */
function getRoleForConversation(
  c: Conversation,
  currentUserId: string | null,
): MatchUserRole {
  if (c.context_type === "buddy") return "sender";
  if (currentUserId && c.participant_1 === currentUserId) return "sender";
  return "carrier";
}

function flagsForConversation(c: Conversation, currentUserId: string | null): ConversationFlags {
  const status = c.match_status ?? "pending";
  const isPending = status === "pending";
  const matchedByOther = !!c.matched_by && c.matched_by !== currentUserId;
  const matchedByMe = !!c.matched_by && c.matched_by === currentUserId;
  return {
    hasUnread: (c.unread_count ?? 0) > 0,
    isMatched: status === "matched",
    awaitingMine: isPending && matchedByOther,
    awaitingTheirs: isPending && matchedByMe,
    isDeclined: status === "declined",
    isBlocked: status === "blocked",
    // `matched_at` (the permanent marker) distinguishes wasUnmatched from a
    // never-matched fresh conversation.
    wasUnmatched: isPending && !c.matched_by && !!c.matched_at,
  };
}

function miniStatusForFlags(flags: ConversationFlags): MiniStatus | null {
  // Web parity (CustomerMessages.tsx:1056-1068): declined uses destructive tone,
  // not muted gray.
  if (flags.awaitingMine)
    return { label: "Match request", bg: "rgba(245, 158, 11, 0.15)", fg: colors.warning };
  if (flags.awaitingTheirs) return { label: "Waiting", bg: colors.surfaceMuted, fg: colors.mutedText };
  if (flags.isMatched) return { label: "Matched", bg: "rgba(34, 197, 94, 0.12)", fg: colors.safe };
  if (flags.isDeclined) return { label: "Declined", bg: "rgba(239, 68, 68, 0.12)", fg: colors.danger };
  if (flags.isBlocked) return { label: "Blocked", bg: "rgba(239, 68, 68, 0.12)", fg: colors.danger };
  if (flags.wasUnmatched) return { label: "Unmatched", bg: colors.surfaceMuted, fg: colors.mutedText };
  return null;
}

export function MessagesScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const {
    conversations,
    loading,
    error,
    mutating,
    refetch,
    acceptMatch,
    declineMatch,
    markConversationRead,
  } = useMyConversations({ currentUserId: user?.id ?? null });

  // Second instance for the WhatsApp-style Archived view. Archiving hides a chat
  // from the inbox above; this is how the user gets back to it to unarchive.
  const {
    conversations: archivedConversations,
    loading: archivedLoading,
    refetch: refetchArchived,
  } = useMyConversations({ currentUserId: user?.id ?? null, archived: true });

  const [showArchived, setShowArchived] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  // The Buddies tab is `freezeOnBlur: true`, so the initial useEffect refetch
  // only runs once. Re-pull on every focus (Inbox → Chat → back) so the unread
  // counts the user just cleared by reading messages reflect immediately —
  // belt-and-suspenders for the realtime path. Pull the archived list too so a
  // chat archived from inside the conversation shows up here right away.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchArchived();
    }, [refetch, refetchArchived]),
  );

  const handleUnarchive = useCallback(
    async (c: Conversation) => {
      setUnarchivingId(c.id);
      try {
        await messagesApi.unarchiveConversation(c.id);
        showToast({ title: "Chat unarchived", variant: "info", duration: 1600 });
        void refetch();
        void refetchArchived();
      } catch (err) {
        showToast({ title: "Couldn't unarchive", message: getErrorMessage(err), variant: "error" });
      } finally {
        setUnarchivingId(null);
      }
    },
    [refetch, refetchArchived],
  );

  // WhatsApp behaviour: when the last archived chat is unarchived, drop back to
  // the inbox automatically rather than leaving an empty Archived screen.
  const noArchivedLeft = showArchived && !archivedLoading && archivedConversations.length === 0;
  useEffect(() => {
    if (noArchivedLeft) setShowArchived(false);
  }, [noArchivedLeft]);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");
  // Track which conversation triggered each modal — null when closed. Two
  // separate slots so accept and decline can coexist without race conditions.
  const [acceptTarget, setAcceptTarget] = useState<Conversation | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Conversation | null>(null);
  const [acceptPending, setAcceptPending] = useState(false);
  const [declinePending, setDeclinePending] = useState(false);

  const onRefresh = useCallback(() => {
    void refetch();
    void refetchArchived();
  }, [refetch, refetchArchived]);

  // Web parity: search filters by participant name + last message preview.
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const name = (c.participant?.name ?? "").toLowerCase();
      const preview = (c.last_message ?? c.last_message_text ?? "").toLowerCase();
      return name.includes(needle) || preview.includes(needle);
    });
  }, [conversations, search]);

  const isAwaitingMine = useCallback(
    (c: Conversation) =>
      c.match_status === "pending" && !!c.matched_by && c.matched_by !== user?.id,
    [user?.id],
  );

  const filtered = useMemo(() => {
    if (filter === "unread") return searched.filter((c) => (c.unread_count ?? 0) > 0);
    if (filter === "requests") return searched.filter(isAwaitingMine);
    return searched;
  }, [searched, filter, isAwaitingMine]);

  const counts = useMemo(
    () => ({
      all: conversations.length,
      unread: conversations.filter((c) => (c.unread_count ?? 0) > 0).length,
      requests: conversations.filter(isAwaitingMine).length,
    }),
    [conversations, isAwaitingMine],
  );

  const requestRows = useMemo(() => filtered.filter(isAwaitingMine), [filtered, isAwaitingMine]);
  const otherRows = useMemo(
    () => filtered.filter((c) => !isAwaitingMine(c)),
    [filtered, isAwaitingMine],
  );

  const handleOpenChat = useCallback(
    (c: Conversation) => {
      // Optimistic: clear the row's unread highlight the instant the user
      // taps. The server will mark messages as read when the chat screen
      // calls GET /messages, and the realtime bus reconciles afterwards —
      // but the user shouldn't have to wait for either.
      markConversationRead(c.id);
      navigation.navigate("OfferChatTab", {
        conversationId: c.id,
        name: c.participant?.name ?? "Conversation",
        source: "messages",
      });
    },
    [navigation, markConversationRead],
  );

  // Web parity: opening a match request from the inbox routes through the
  // MatchConfirmationModal so the user must acknowledge responsibilities
  // before the optimistic accept fires.
  const openAccept = useCallback((c: Conversation) => setAcceptTarget(c), []);
  const openDecline = useCallback((c: Conversation) => setDeclineTarget(c), []);

  const handleAcceptConfirm = useCallback(async () => {
    if (!acceptTarget) return;
    setAcceptPending(true);
    try {
      await acceptMatch(acceptTarget.id);
      setAcceptTarget(null);
      showToast({ title: "Matched", variant: "success", duration: 1800 });
    } catch (err) {
      showToast({
        title: "Couldn't accept",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setAcceptPending(false);
    }
  }, [acceptTarget, acceptMatch]);

  const handleDeclineConfirm = useCallback(
    async (reason: string) => {
      if (!declineTarget) return;
      setDeclinePending(true);
      try {
        await declineMatch(declineTarget.id, reason || undefined);
        setDeclineTarget(null);
        showToast({ title: "Match declined", variant: "info", duration: 1800 });
      } catch (err) {
        showToast({
          title: "Couldn't decline",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setDeclinePending(false);
      }
    },
    [declineTarget, declineMatch],
  );

  const renderRow = useCallback(
    ({ item }: ListRenderItemInfo<Conversation>) => (
      <ConversationRow
        conversation={item}
        currentUserId={user?.id ?? null}
        mutating={mutating}
        onOpen={handleOpenChat}
        onAccept={openAccept}
        onDecline={openDecline}
        onMatchAgain={openAccept}
        onUnarchive={showArchived ? handleUnarchive : undefined}
        unarchiving={unarchivingId === item.id}
      />
    ),
    [user?.id, mutating, handleOpenChat, openAccept, openDecline, showArchived, handleUnarchive, unarchivingId],
  );

  const renderEmpty = useCallback(() => {
    if (loading) {
      // Web parity: 5 skeleton placeholder cards while initial load is in flight.
      return <InboxSkeleton />;
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load inbox</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.centered}>
        <View style={styles.emptyIconBox}>
          <Ionicons
            name={search ? "search-outline" : "chatbox-outline"}
            size={26}
            color={colors.primary}
          />
        </View>
        <Text style={styles.emptyTitle}>
          {search ? "No matches" : "No conversations yet"}
        </Text>
        <Text style={styles.emptySubtitle}>
          {search
            ? `Nothing in your inbox matches "${search}".`
            : "Messages from parcel interactions will appear here."}
        </Text>
        {search ? (
          <Pressable
            style={styles.retryButton}
            onPress={() => setSearch("")}
            accessibilityRole="button"
            accessibilityLabel="Clear search"
          >
            <Text style={styles.retryButtonText}>Clear search</Text>
          </Pressable>
        ) : null}
      </View>
    );
  }, [loading, error, search, refetch]);

  // Two-section layout: Match requests on top, then everything else.
  const sectionedData = useMemo<Conversation[]>(
    () => [...requestRows, ...otherRows],
    [requestRows, otherRows],
  );

  const keyExtractor = useCallback((c: Conversation) => c.id, []);

  const acceptUserRole = acceptTarget
    ? getRoleForConversation(acceptTarget, user?.id ?? null)
    : "sender";

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <FlatList
        data={showArchived ? archivedConversations : sectionedData}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={
          showArchived ? (
            <ArchivedHeader
              count={archivedConversations.length}
              onBack={() => setShowArchived(false)}
            />
          ) : (
            <>
              <ListHeader
                search={search}
                onSearch={setSearch}
                filter={filter}
                onFilter={setFilter}
                counts={counts}
                requestRowsCount={requestRows.length}
              />
              {archivedConversations.length > 0 ? (
                <ArchivedBanner
                  count={archivedConversations.length}
                  onPress={() => setShowArchived(true)}
                />
              ) : null}
            </>
          )
        }
        ListEmptyComponent={showArchived ? ArchivedEmpty : renderEmpty}
        ItemSeparatorComponent={({ leadingItem }) => {
          if (showArchived || !leadingItem || requestRows.length === 0 || otherRows.length === 0)
            return null;
          const isLastRequest = requestRows[requestRows.length - 1]?.id === (leadingItem as Conversation).id;
          if (!isLastRequest) return null;
          // Web parity: "All conversations" label only appears when there's
          // also a Match Requests section above it.
          return (
            <View style={styles.sectionHeading}>
              <Text style={styles.sectionHeadingText}>ALL CONVERSATIONS</Text>
            </View>
          );
        }}
        contentContainerStyle={[
          styles.listContent,
          (showArchived ? archivedConversations.length === 0 : sectionedData.length === 0) &&
            styles.listContentEmpty,
        ]}
        refreshControl={
          <RefreshControl
            refreshing={
              showArchived
                ? archivedLoading && archivedConversations.length > 0
                : loading && conversations.length > 0
            }
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        windowSize={7}
        initialNumToRender={10}
      />

      <MatchConfirmationModal
        open={!!acceptTarget}
        pending={acceptPending}
        userRole={acceptUserRole}
        contextType={acceptTarget?.context_type}
        onCancel={() => {
          if (!acceptPending) setAcceptTarget(null);
        }}
        onConfirm={() => void handleAcceptConfirm()}
      />

      <DeclineMatchModal
        open={!!declineTarget}
        participantName={declineTarget?.participant?.name ?? "this user"}
        pending={declinePending}
        // Inbox decline is always for an incoming match request — that's the
        // ONLY decline affordance we expose on the row tail.
        matchRequestFromOther
        onCancel={() => {
          if (!declinePending) setDeclineTarget(null);
        }}
        onConfirm={(reason) => void handleDeclineConfirm(reason)}
      />
    </Screen>
  );
}

// ───────────────────────── List header (search + filter + section labels) ─────────────────────────

interface ListHeaderProps {
  search: string;
  onSearch: (v: string) => void;
  filter: InboxFilter;
  onFilter: (f: InboxFilter) => void;
  counts: { all: number; unread: number; requests: number };
  requestRowsCount: number;
}

const ListHeader = memo(function ListHeader({
  search,
  onSearch,
  filter,
  onFilter,
  counts,
  requestRowsCount,
}: Readonly<ListHeaderProps>) {
  // Web parity (CustomerMessages.tsx:1217-1259): every chip shows its count
  // (including "All"), wrapped together with the search input inside a single
  // bordered header card.
  const filters: readonly { key: InboxFilter; label: string; count: number }[] = [
    { key: "all", label: "All", count: counts.all },
    { key: "unread", label: "Unread", count: counts.unread },
    { key: "requests", label: "Requests", count: counts.requests },
  ];

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Inbox</Text>
        <PrimaryHeaderActions />
      </View>

      <View style={styles.headerCard}>
        {/* Fixed set of 3 filters — spread them evenly across the row so there's
            no dead space on the right (a horizontal scroller only hugged their
            content width). */}
        <View style={styles.chipsRow}>
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onFilter(f.key)}
                style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${f.label}`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}
                >
                  {f.label}
                </Text>
                <View style={[styles.chipCount, active ? styles.chipCountActive : styles.chipCountInactive]}>
                  <Text
                    style={[
                      styles.chipCountText,
                      active ? styles.chipCountTextActive : styles.chipCountTextInactive,
                    ]}
                  >
                    {f.count}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.searchRow}>
          <Ionicons name="search-outline" size={18} color={colors.mutedText} />
          <TextInput
            value={search}
            onChangeText={onSearch}
            placeholder="Search conversations…"
            placeholderTextColor={colors.subtleText}
            style={styles.searchInput}
            autoCorrect={false}
            autoCapitalize="none"
            returnKeyType="search"
          />
          {search ? (
            <Pressable
              onPress={() => onSearch("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={colors.mutedText} />
            </Pressable>
          ) : null}
        </View>
      </View>

      {requestRowsCount > 0 ? (
        <View style={styles.matchRequestsHeading}>
          <Text style={styles.matchRequestsText}>MATCH REQUESTS</Text>
          <View style={styles.matchRequestsCount}>
            <Text style={styles.matchRequestsCountText}>{requestRowsCount}</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
});

// ───────────────────────── Loading skeleton ─────────────────────────

/**
 * Mirrors web's 5 placeholder rows during the initial load. Pure layout —
 * no Animated dependency to keep the bundle slim. Web uses an `animate-pulse`
 * tailwind class; on RN we just render a static muted-tone card stack which
 * reads as "loading" against the surrounding chrome.
 */
function InboxSkeleton() {
  const placeholders = [0, 1, 2, 3, 4];
  return (
    <View style={styles.skeletonWrap}>
      {placeholders.map((i) => (
        <View key={i} style={styles.skeletonCard}>
          <SkeletonBlock style={styles.skeletonAvatar} />
          <View style={styles.skeletonBody}>
            <SkeletonBlock style={styles.skeletonNameBar} />
            <SkeletonBlock style={styles.skeletonPreviewBar} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Conversation row ─────────────────────────

interface ConversationRowProps {
  conversation: Conversation;
  currentUserId: string | null;
  mutating: boolean;
  onOpen: (c: Conversation) => void;
  onAccept: (c: Conversation) => void;
  onDecline: (c: Conversation) => void;
  /** Re-match a previously declined or unmatched conversation. */
  onMatchAgain: (c: Conversation) => void;
  /** Present only in the Archived view — shows an Unarchive action in the tail. */
  onUnarchive?: (c: Conversation) => void;
  unarchiving?: boolean;
}

const ConversationRow = memo(function ConversationRow({
  conversation,
  currentUserId,
  mutating,
  onOpen,
  onAccept,
  onDecline,
  onMatchAgain,
  onUnarchive,
  unarchiving,
}: Readonly<ConversationRowProps>) {
  const flags = flagsForConversation(conversation, currentUserId);
  const miniStatus = miniStatusForFlags(flags);
  const name = conversation.participant?.name ?? "Unknown";
  const initials = getInitials(name);
  const avatarUrl = conversation.participant?.avatar_url ?? null;
  const preview = conversation.last_message ?? conversation.last_message_text ?? "Start the conversation";
  const time = formatRowTime(conversation.last_message_at);

  // Web parity: ring color around avatar communicates match state.
  const ringStyle = flags.isMatched
    ? styles.ringMatched
    : flags.awaitingMine
      ? styles.ringAwaitingMine
      : flags.isBlocked
        ? styles.ringBlocked
        : styles.ringDefault;

  return (
    <Pressable
      onPress={() => onOpen(conversation)}
      style={[styles.row, flags.hasUnread && styles.rowUnread]}
      accessibilityRole="button"
      accessibilityLabel={`Open conversation with ${name}`}
    >
      {flags.hasUnread ? <View style={styles.unreadStripe} /> : null}

      <View style={[styles.avatarWrap, ringStyle]}>
        {avatarUrl ? (
          <Image source={{ uri: avatarUrl }} style={styles.avatarImage} />
        ) : (
          <View style={styles.avatar}>
            <Text style={styles.avatarLabel}>{initials}</Text>
          </View>
        )}
        {flags.hasUnread ? <View style={styles.unreadDot} /> : null}
      </View>

      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text
            style={[styles.name, flags.hasUnread && styles.nameUnread]}
            numberOfLines={1}
          >
            {name}
          </Text>
          {miniStatus ? (
            <View style={[styles.miniStatusPill, { backgroundColor: miniStatus.bg }]}>
              <Text style={[styles.miniStatusText, { color: miniStatus.fg }]}>
                {miniStatus.label}
              </Text>
            </View>
          ) : null}
        </View>
        <Text
          style={[styles.preview, flags.hasUnread && styles.previewUnread]}
          numberOfLines={1}
        >
          {preview}
        </Text>
      </View>

      <View style={styles.tail}>
        <Text style={[styles.timeText, flags.hasUnread && styles.timeUnread]}>{time}</Text>
        {/*
         * Tail action precedence (web parity):
         *   1. Awaiting-mine → Accept (green) + Close (outline)
         *   2. Declined or Unmatched → "Match again" (green)
         *   3. Has unread → numeric badge (capped at "9+")
         *   4. Otherwise → time only (already rendered above)
         */}
        {onUnarchive ? (
          <Pressable
            onPress={() => onUnarchive(conversation)}
            disabled={unarchiving}
            style={[styles.actionButton, styles.unarchiveButton]}
            accessibilityRole="button"
            accessibilityLabel="Unarchive chat"
            hitSlop={4}
          >
            <Ionicons name="arrow-undo-outline" size={12} color={colors.primary} />
            <Text style={styles.unarchiveButtonText}>{unarchiving ? "…" : "Unarchive"}</Text>
          </Pressable>
        ) : flags.awaitingMine ? (
          <View style={styles.actionsRow}>
            <Pressable
              onPress={() => onAccept(conversation)}
              disabled={mutating}
              style={[styles.actionButton, styles.acceptButton]}
              accessibilityRole="button"
              accessibilityLabel="Accept match request"
              hitSlop={4}
            >
              <Text style={styles.acceptButtonText}>Accept</Text>
            </Pressable>
            <Pressable
              onPress={() => onDecline(conversation)}
              disabled={mutating}
              style={[styles.actionButton, styles.declineButton]}
              accessibilityRole="button"
              accessibilityLabel="Close match request"
              hitSlop={4}
            >
              <Text style={styles.declineButtonText}>Close</Text>
            </Pressable>
          </View>
        ) : flags.isDeclined || flags.wasUnmatched ? (
          <Pressable
            onPress={() => onMatchAgain(conversation)}
            disabled={mutating}
            style={[styles.actionButton, styles.acceptButton]}
            accessibilityRole="button"
            accessibilityLabel="Match again"
            hitSlop={4}
          >
            <Text style={styles.acceptButtonText}>Match again</Text>
          </Pressable>
        ) : flags.hasUnread ? (
          <View style={styles.unreadCountBadge}>
            <Text style={styles.unreadCountText}>
              {conversation.unread_count > 9 ? "9+" : conversation.unread_count}
            </Text>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
});

// ───────────────────────── Archived section (WhatsApp-style) ─────────────────────────

/** Tappable banner at the top of the inbox that opens the Archived list. */
function ArchivedBanner({ count, onPress }: Readonly<{ count: number; onPress: () => void }>) {
  return (
    <Pressable
      onPress={onPress}
      style={styles.archivedBanner}
      accessibilityRole="button"
      accessibilityLabel={`Archived, ${count} chat${count === 1 ? "" : "s"}`}
    >
      <View style={styles.archivedIconBox}>
        <Ionicons name="archive" size={17} color={colors.primary} />
      </View>
      <Text style={styles.archivedBannerText}>Archived</Text>
      <View style={styles.archivedCount}>
        <Text style={styles.archivedCountText}>{count}</Text>
      </View>
      <Ionicons name="chevron-forward" size={18} color={colors.mutedText} />
    </Pressable>
  );
}

/** Header for the Archived list view, with a back affordance to the inbox. */
function ArchivedHeader({ count, onBack }: Readonly<{ count: number; onBack: () => void }>) {
  return (
    <View style={styles.archivedHeaderWrap}>
      <View style={styles.archivedHeaderRow}>
        <Pressable
          onPress={onBack}
          hitSlop={8}
          style={styles.archivedBackBtn}
          accessibilityRole="button"
          accessibilityLabel="Back to inbox"
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Archived</Text>
      </View>
      <Text style={styles.archivedHint}>
        {count} archived chat{count === 1 ? "" : "s"} · hidden from your inbox.
      </Text>
    </View>
  );
}

function ArchivedEmpty() {
  return (
    <View style={styles.centered}>
      <View style={styles.emptyIconBox}>
        <Ionicons name="archive-outline" size={26} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>No archived chats</Text>
      <Text style={styles.emptySubtitle}>Chats you archive will appear here.</Text>
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 20, paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },

  // Header
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginTop: 16,
    marginBottom: 14,
  },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },

  // Web parity: filter chips + search wrapped in a single bordered card.
  headerCard: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    padding: 12,
    marginBottom: 14,
    gap: 10,
  },
  chipsRow: { flexDirection: "row", gap: 8 },
  chip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInactive: { backgroundColor: colors.card, borderColor: colors.border },
  chipText: { fontSize: 12, fontWeight: "800" },
  chipTextActive: { color: colors.white },
  chipTextInactive: { color: colors.mutedText },
  chipCount: {
    minWidth: 18,
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 999,
    alignItems: "center",
    justifyContent: "center",
  },
  chipCountActive: { backgroundColor: "rgba(255,255,255,0.22)" },
  chipCountInactive: { backgroundColor: colors.surfaceMuted },
  chipCountText: { fontSize: 10, fontWeight: "800" },
  chipCountTextActive: { color: colors.white },
  chipCountTextInactive: { color: colors.text },

  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 14, color: colors.text, padding: 0, fontWeight: "500" },

  // "ALL CONVERSATIONS" separator (between Match Requests and the rest).
  sectionHeading: { paddingHorizontal: 4, marginTop: 4, marginBottom: 8 },
  sectionHeadingText: {
    color: colors.mutedText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },

  // "MATCH REQUESTS" header — warning-toned with inline count badge.
  matchRequestsHeading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 4,
    marginBottom: 10,
  },
  matchRequestsText: {
    color: colors.warning,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  matchRequestsCount: {
    minWidth: 20,
    height: 20,
    paddingHorizontal: 6,
    borderRadius: 999,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  matchRequestsCountText: {
    color: colors.warning,
    fontSize: 10,
    fontWeight: "800",
  },

  // Row
  row: {
    position: "relative",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 10,
  },
  rowUnread: {
    backgroundColor: "rgba(255, 122, 38, 0.06)",
    borderColor: "rgba(255, 122, 38, 0.20)",
  },
  unreadStripe: {
    position: "absolute",
    left: 4,
    top: 12,
    bottom: 12,
    width: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
  },

  avatarWrap: { position: "relative" },
  avatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: 46, height: 46, borderRadius: 23 },
  avatarLabel: { color: colors.text, fontSize: 16, fontWeight: "800" },
  ringDefault: { borderRadius: 25, padding: 2, borderWidth: 1, borderColor: colors.border },
  ringMatched: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.safe },
  ringAwaitingMine: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.warning },
  ringBlocked: { borderRadius: 25, padding: 2, borderWidth: 2, borderColor: colors.danger },
  unreadDot: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: colors.card,
  },

  body: { flex: 1, minWidth: 0 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { color: colors.text, fontSize: 15, fontWeight: "600", flexShrink: 1 },
  nameUnread: { fontWeight: "800" },
  miniStatusPill: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 },
  miniStatusText: { fontSize: 9, fontWeight: "800", letterSpacing: 0.4 },
  preview: { color: colors.mutedText, fontSize: 13, marginTop: 4 },
  previewUnread: { color: colors.text, fontWeight: "600" },

  tail: { alignItems: "flex-end", gap: 6 },
  timeText: { color: colors.mutedText, fontSize: 11, fontWeight: "500" },
  timeUnread: { color: colors.primary, fontWeight: "800" },
  actionsRow: { flexDirection: "row", gap: 6 },
  actionButton: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  acceptButton: { backgroundColor: colors.safe },
  acceptButtonText: { color: colors.white, fontSize: 11, fontWeight: "800" },
  declineButton: {
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  declineButtonText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  unarchiveButton: {
    flexDirection: "row",
    gap: 4,
    alignItems: "center",
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: "rgba(93, 63, 211, 0.30)",
  },
  unarchiveButtonText: { color: colors.primary, fontSize: 11, fontWeight: "800" },

  // Archived (WhatsApp-style)
  archivedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
  },
  archivedIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  archivedBannerText: { flex: 1, color: colors.text, fontSize: 15, fontWeight: "700" },
  archivedCount: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 7,
    borderRadius: 11,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  archivedCountText: { color: colors.text, fontSize: 11, fontWeight: "800" },
  archivedHeaderWrap: { marginTop: 16, marginBottom: 14, gap: 6 },
  archivedHeaderRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  archivedBackBtn: {
    width: 32,
    height: 32,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: -6,
  },
  archivedHint: { color: colors.mutedText, fontSize: 12, paddingHorizontal: 2 },
  // Tail-side unread count badge (shown when there's no other action button).
  unreadCountBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  unreadCountText: {
    color: colors.white,
    fontSize: 10,
    fontWeight: "800",
  },

  // Loading skeletons (web parity: 5 placeholder cards while initial load runs).
  skeletonWrap: { gap: 10, paddingTop: 4 },
  skeletonCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 16,
    padding: 14,
  },
  skeletonAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    backgroundColor: colors.border,
  },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonNameBar: {
    height: 12,
    width: "40%",
    borderRadius: 6,
    backgroundColor: colors.border,
  },
  skeletonPreviewBar: {
    height: 10,
    width: "75%",
    borderRadius: 5,
    backgroundColor: colors.border,
    opacity: 0.7,
  },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceWarm,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptySubtitle: {
    color: colors.subtleText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 18,
  },
});
