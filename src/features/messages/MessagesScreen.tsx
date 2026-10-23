import { memo, useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
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
import { DeclineMatchModal } from "@/components/chat/DeclineMatchModal";
import { MatchConfirmationModal } from "@/components/chat/MatchConfirmationModal";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useMyConversations } from "@/hooks/api/useMyConversations";
import { refreshUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
import { getErrorMessage, messagesApi, type Conversation } from "@/services/api";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";

import { ArchivedBanner, ArchivedEmpty, ArchivedHeader } from "./inbox/ArchivedViews";
import { ConversationRow } from "./inbox/ConversationRow";
import { InboxSkeleton } from "./inbox/InboxSkeleton";
import { inboxStyles } from "./inbox/inboxStyles";
import { type InboxFilter, type Nav } from "./inbox/inboxTypes";
import { useInboxFilters } from "./inbox/useInboxFilters";
import { useInboxMatchActions } from "./inbox/useInboxMatchActions";

export function MessagesScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();

  const {
    conversations,
    loading,
    error,
    mutating,
    refetch,
    hasMore,
    loadMore,
    loadingMore,
    total,
    unreadChats,
    acceptMatch,
    declineMatch,
    markConversationRead,
  } = useMyConversations({ currentUserId: user?.id ?? null });

  // Second instance for the WhatsApp-style Archived view. Archiving hides a chat
  // from the inbox above; this is how the user gets back to it to unarchive.
  const {
    conversations: archivedConversations,
    loading: archivedLoading,
    error: archivedError,
    refetch: refetchArchived,
    hasMore: hasMoreArchived,
    loadMore: loadMoreArchived,
    loadingMore: loadingMoreArchived,
    total: archivedTotal,
  } = useMyConversations({ currentUserId: user?.id ?? null, archived: true });
  // The Archived banner/header count: all archived threads, not just the page.
  const archivedCount = hasMoreArchived
    ? Math.max(archivedTotal ?? 0, archivedConversations.length)
    : archivedConversations.length;

  const [showArchived, setShowArchived] = useState(false);
  const [unarchivingId, setUnarchivingId] = useState<string | null>(null);

  // The Buddies tab is `freezeOnBlur: true`, so the initial useEffect refetch
  // only runs once. Re-pull on every focus (Inbox → Chat → back) so the unread
  // counts the user just cleared by reading messages reflect immediately —
  // belt-and-suspenders for the realtime path. Pull the archived list too so a
  // chat archived from inside the conversation shows up here right away.
  // The tab badge too: reading the thread marked its messages read on the
  // server, and the badge must not wait on realtime to notice.
  useFocusEffect(
    useCallback(() => {
      void refetch();
      void refetchArchived();
      refreshUnreadInboxCount();
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
  // the inbox automatically rather than leaving an empty Archived screen. Not on
  // a failed load: that is "couldn't load", shown with Retry below.
  const noArchivedLeft = showArchived && !archivedLoading && !archivedError && archivedConversations.length === 0;
  useEffect(() => {
    if (noArchivedLeft) setShowArchived(false);
  }, [noArchivedLeft]);

  // Search + filter chips, and the two-section split — see `useInboxFilters`.
  const { search, setSearch, filter, setFilter, counts, requestRows, otherRows, sectionedData } =
    useInboxFilters({ conversations, user, hasMore, serverTotal: total, serverUnreadChats: unreadChats });
  // Accept / decline from a row — see `useInboxMatchActions`.
  const {
    acceptTarget, setAcceptTarget, declineTarget, setDeclineTarget, acceptPending, declinePending,
    openAccept, openDecline, handleAcceptConfirm, handleDeclineConfirm, acceptUserRole,
  } = useInboxMatchActions({ user, acceptMatch, declineMatch });

  const onRefresh = useCallback(() => {
    void refetch();
    void refetchArchived();
  }, [refetch, refetchArchived]);

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
    // The Archived view has its own request: a failure there was shown as
    // "No conversations yet", which reads as "your archived chats are gone".
    const listLoading = showArchived ? archivedLoading : loading;
    const listError = showArchived ? archivedError : error;
    const retry = showArchived ? refetchArchived : refetch;
    if (listLoading) {
      // Web parity: 5 skeleton placeholder cards while initial load is in flight.
      return <InboxSkeleton />;
    }
    if (listError) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>{showArchived ? "Couldn't load archived chats" : "Couldn't load inbox"}</Text>
          <Text style={styles.errorBody}>{getErrorMessage(listError)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void retry()}
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
  }, [showArchived, archivedLoading, archivedError, refetchArchived, loading, error, search, refetch, setSearch]);

  const keyExtractor = useCallback((c: Conversation) => c.id, []);

  // The inbox is paged. Without this a thread past the first page could never
  // be opened, and its unread messages (which the tab badge counts) never
  // cleared. Web shows a "Load more conversations" button for the same thing.
  const onEndReached = useCallback(() => {
    void (showArchived ? loadMoreArchived() : loadMore());
  }, [showArchived, loadMore, loadMoreArchived]);
  const showFooterSpinner = showArchived ? loadingMoreArchived : loadingMore;
  const renderFooter = useCallback(
    () =>
      showFooterSpinner ? (
        <View style={styles.footerLoading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null,
    [showFooterSpinner],
  );

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <FlatList
        data={showArchived ? archivedConversations : sectionedData}
        keyExtractor={keyExtractor}
        renderItem={renderRow}
        ListHeaderComponent={
          showArchived ? (
            <ArchivedHeader
              count={archivedCount}
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
                  count={archivedCount}
                  onPress={() => setShowArchived(true)}
                />
              ) : null}
            </>
          )
        }
        ListEmptyComponent={showArchived ? ArchivedEmpty : renderEmpty}
        ListFooterComponent={renderFooter}
        onEndReached={onEndReached}
        onEndReachedThreshold={0.5}
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
              colors={[colors.primary]}
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
    // Unread CHATS: the tab badge counts unread MESSAGES, so a bare "Unread 1"
    // under a badge of 3 read as a bug. Same label on web.
    { key: "unread", label: "Unread chats", count: counts.unread },
    { key: "requests", label: "Requests", count: counts.requests },
  ];

  return (
    <View>
      <View style={styles.titleRow}>
        <Text style={styles.title}>Inbox</Text>
        <PrimaryHeaderActions />
      </View>

      <View style={styles.headerCard}>
        {/* Fixed set of 3 filters — spread across the row so there's no dead space.
            ⚠️ They must SHRINK to the row, never overflow it: on a zoomed iPhone 8
            (320pt) "Requests" ran off the card and "Unread chats" was cut (client,
            23 Oct 2026). The old shrink-to-fit never worked - the label had no
            width bound to fit into. Chips and labels now shrink (minWidth 0), the
            label scales down a little, and truncates only as a last resort. */}
        <View style={styles.chipsRow}>
          {filters.map((f) => {
            const active = f.key === filter;
            return (
              <Pressable
                key={f.key}
                onPress={() => onFilter(f.key)}
                // "All" is one short word: it keeps its size; the longer labels give.
                style={[styles.chip, f.key === "all" && styles.chipFixed, active ? styles.chipActive : styles.chipInactive]}
                // The chip paints 30dp tall, under the 44pt minimum, and unlike the
                // other controls on this screen it carried no hitSlop at all. This
                // lifts the touch target to 46dp without changing the visual design.
                hitSlop={{ top: 8, bottom: 8, left: 4, right: 4 }}
                accessibilityRole="button"
                accessibilityLabel={`Filter: ${f.label}, ${f.count}`}
                accessibilityState={{ selected: active }}
              >
                <Text
                  style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}
                  numberOfLines={1}
                  adjustsFontSizeToFit
                  minimumFontScale={0.75}
                  maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}
                >
                  {f.label}
                </Text>
                <View style={[styles.chipCount, active ? styles.chipCountActive : styles.chipCountInactive]}>
                  <Text
                    maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}
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

// ───────────────────────── Styles ─────────────────────────

const screenStyles = StyleSheet.create({
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
  chipsRow: { flexDirection: "row", gap: 6 },
  chip: {
    // Grow from the label's own width (not equal thirds) so the longer
    // "Unread chats" label gets the room it needs; shrink when the row is short.
    flexGrow: 1,
    flexShrink: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
  },
  chipFixed: { flexShrink: 0 },
  chipActive: { backgroundColor: colors.primary, borderColor: colors.primary },
  chipInactive: { backgroundColor: colors.card, borderColor: colors.border },
  // flexShrink + minWidth give the label a width bound, which adjustsFontSizeToFit needs.
  chipText: { fontSize: 12, fontWeight: "800", flexShrink: 1, minWidth: 0 },
  chipTextActive: { color: colors.white },
  chipTextInactive: { color: colors.mutedText },
  chipCount: {
    flexShrink: 0,
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
  footerLoading: { paddingVertical: 16, alignItems: "center" },
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

  // Loading / error / empty
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
});

const styles = { ...inboxStyles, ...screenStyles };
