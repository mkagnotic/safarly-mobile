import { useCallback, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import {
  CompositeNavigationProp,
  useFocusEffect,
  useNavigation,
} from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Image, Platform, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { useAuth } from "@/context/AuthContext";
import { useActivityFeed } from "@/hooks/api/useActivityFeed";
import { useMyConversations } from "@/hooks/api/useMyConversations";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { useUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
import { useUnreadNotificationsCount } from "@/hooks/api/useUnreadNotificationsCount";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { type Conversation, type FeedItem } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { shadowCard, shadowSoft } from "@/theme/elevation";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/** "Mar 30" — same shape web uses on the activity card. */
function formatShortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const { user } = useAuth();
  const { profile, refetch: refetchProfile } = useMyProfile();
  const { items: activity, loading: activityLoading, refetch: refetchActivity } =
    useActivityFeed({ perPage: 4 });
  const { conversations, loading: convsLoading, refetch: refetchConvs } =
    useMyConversations({ currentUserId: user?.id ?? null, perPage: 20 });
  const { count: messagesUnread } = useUnreadInboxCount();
  const { count: notificationsUnread } = useUnreadNotificationsCount();

  const airplaneStyle = Platform.OS === "ios" ? styles.airplaneTiltIos : styles.airplaneTilt;

  // Web parity (`CustomerHome.tsx:46-50`): drop self-conversations + only
  // ones the dedupe layer recognises as a real participant.
  const visibleConversations = useMemo(
    () =>
      conversations.filter(
        (c) =>
          c.participant_1 !== c.participant_2 &&
          c.participant?.id !== user?.id,
      ),
    [conversations, user?.id],
  );

  const greetingName = profile?.name ?? "there";

  const handleRefresh = useCallback(() => {
    void refetchProfile();
    void refetchActivity();
    void refetchConvs();
  }, [refetchProfile, refetchActivity, refetchConvs]);

  // Refetch every time Home regains focus — covers the case where realtime
  // didn't fire while the user was elsewhere (e.g. in Settings).
  useFocusEffect(
    useCallback(() => {
      void refetchActivity();
      void refetchConvs();
    }, [refetchActivity, refetchConvs]),
  );

  const openConversation = useCallback(
    (c: Conversation) => {
      navigation.navigate("OfferChatTab", {
        conversationId: c.id,
        name: c.participant?.name ?? "Conversation",
        source: "home",
      });
    },
    [navigation],
  );

  const renderActivityRow = (item: FeedItem) => (
    <Pressable
      key={item.id}
      onPress={() => navigation.navigate("Parcels")}
      style={styles.activityRow}
      accessibilityRole="button"
      accessibilityLabel={item.title}
    >
      <Text style={styles.activityTitle} numberOfLines={2}>
        {item.title}
      </Text>
      {item.description ? (
        <Text style={styles.activityDescription} numberOfLines={2}>
          {item.description}
        </Text>
      ) : null}
      <Text style={styles.activityDate}>
        {formatShortDate(item.created_at).toUpperCase()}
      </Text>
    </Pressable>
  );

  return (
    <Screen onRefresh={handleRefresh}>
      {/* ───────── Header ───────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.muted}>Welcome back</Text>
          <Text style={styles.title} numberOfLines={1}>
            {greetingName}
          </Text>
        </View>
        <View style={styles.headerActions}>
          <Pressable
            style={styles.iconBadge}
            onPress={() => navigation.navigate("SearchTab")}
            accessibilityRole="button"
            accessibilityLabel="Search"
          >
            <Ionicons name="search-outline" size={18} color={colors.text} />
          </Pressable>
          <Pressable
            style={styles.iconBadge}
            onPress={() => navigation.navigate("Notifications")}
            accessibilityRole="button"
            accessibilityLabel={
              notificationsUnread > 0
                ? `Notifications, ${notificationsUnread} unread`
                : "Notifications"
            }
          >
            <Ionicons name="notifications-outline" size={18} color={colors.text} />
            {notificationsUnread > 0 ? <View style={styles.badgeDot} /> : null}
          </Pressable>
        </View>
      </View>

      {/* ───────── Hero ───────── */}
      <Card elevated={false} style={[styles.heroCard, shadowCard()]}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={12} color={colors.primary} />
          <Text style={styles.heroBadgeText}>Peer-to-peer delivery network</Text>
        </View>
        <Text style={styles.heroTitle}>
          Send & receive parcels with{"\n"}
          <Text style={styles.heroAccent}>trusted carriers</Text>
        </Text>
        <Text style={styles.heroBody}>
          Safarly connects you with verified travelers heading your way. Ship
          parcels safely, find travel companions, and build trust across borders.
        </Text>
      </Card>

      {/* ───────── Primary action cards (3) ───────── */}
      <View style={styles.actionGrid}>
        <ActionCard
          chip="Earn on your route"
          title="Send (Carrier)"
          subtitle="I'm traveling and can deliver parcels"
          icon="airplane-outline"
          iconStyle={airplaneStyle}
          tint={colors.primary}
          tintBg={colors.surfaceTintPrimary}
          onPress={() => navigation.navigate("ListTripTab")}
        />
        <ActionCard
          chip="Match with travelers"
          title="Receive"
          subtitle="I need someone to bring me a package"
          icon="download"
          tint={colors.safe}
          tintBg="rgba(34, 195, 93, 0.12)"
          onPress={() => navigation.navigate("SendParcelTab")}
        />
        <ActionCard
          chip="Community match"
          title="Travel Buddy"
          subtitle="Find companions for safe travel"
          icon="people-outline"
          tint={colors.warning}
          tintBg="rgba(245, 159, 10, 0.14)"
          onPress={() => navigation.navigate("CreateBuddyTab")}
        />
      </View>

      {/* ───────── Activity ───────── */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.surfaceTintPrimary }]}>
            <Ionicons name="flash-outline" size={16} color={colors.primary} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Activity</Text>
            <Text style={styles.sectionSubtitle}>Recent updates on your account</Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate("ActivityTab")}
          accessibilityRole="button"
          accessibilityLabel="See all activity"
          hitSlop={8}
        >
          <Text style={styles.seeAll}>See all</Text>
        </Pressable>
      </View>
      <Card style={styles.sectionCard}>
        {activityLoading && activity.length === 0 ? (
          <SkeletonRows count={2} />
        ) : activity.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="flash-outline" size={28} color={colors.subtleText} />
            <Text style={styles.emptyTitle}>No recent activity</Text>
            <Text style={styles.emptyBody}>
              When you send a parcel or list a trip, it'll show up here.
            </Text>
          </View>
        ) : (
          <View style={styles.sectionList}>{activity.map(renderActivityRow)}</View>
        )}
      </Card>

      {/* ───────── Messages ───────── */}
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: "rgba(34, 195, 93, 0.12)" }]}>
            <Ionicons name="chatbubbles-outline" size={16} color={colors.safe} />
          </View>
          <View style={styles.sectionHeaderText}>
            <Text style={styles.sectionTitle}>Messages</Text>
            <Text style={styles.sectionSubtitle}>Chats with carriers and buddies</Text>
          </View>
        </View>
        <Pressable
          onPress={() => navigation.navigate("MessagesTab")}
          accessibilityRole="button"
          accessibilityLabel={
            messagesUnread > 0
              ? `Open inbox, ${messagesUnread} unread`
              : "Open inbox"
          }
          hitSlop={8}
        >
          <Text style={styles.seeAll}>
            Open inbox{messagesUnread > 0 ? ` (${messagesUnread > 9 ? "9+" : messagesUnread})` : ""}
          </Text>
        </Pressable>
      </View>
      <Card style={styles.sectionCard}>
        {convsLoading && visibleConversations.length === 0 ? (
          <SkeletonRows count={3} />
        ) : visibleConversations.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="chatbubbles-outline" size={28} color={colors.subtleText} />
            <Text style={styles.emptyTitle}>No conversations yet</Text>
            <Text style={styles.emptyBody}>
              Match with a carrier or buddy and your conversations will appear here.
            </Text>
          </View>
        ) : (
          <View style={styles.sectionList}>
            {visibleConversations.slice(0, 3).map((c) => (
              <ConversationRow
                key={c.id}
                conversation={c}
                onPress={() => openConversation(c)}
              />
            ))}
          </View>
        )}
      </Card>
    </Screen>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

interface ActionCardProps {
  chip: string;
  title: string;
  subtitle: string;
  icon: keyof typeof Ionicons.glyphMap;
  iconStyle?: ReturnType<typeof StyleSheet.create>[string];
  tint: string;
  tintBg: string;
  onPress: () => void;
}

function ActionCard({
  chip,
  title,
  subtitle,
  icon,
  iconStyle,
  tint,
  tintBg,
  onPress,
}: Readonly<ActionCardProps>) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionCard, shadowCard()]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.actionTopRow}>
        <View style={[styles.actionIconBox, { backgroundColor: tintBg }]}>
          <Ionicons name={icon} size={22} color={tint} style={iconStyle} />
        </View>
        <View style={styles.actionChevronCircle}>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
        </View>
      </View>
      <Text style={styles.actionChip}>{chip.toUpperCase()}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

interface ConversationRowProps {
  conversation: Conversation;
  onPress: () => void;
}

function ConversationRow({ conversation, onPress }: Readonly<ConversationRowProps>) {
  const name = conversation.participant?.name ?? "Unknown";
  const initials = getInitials(name);
  const avatarUrl = conversation.participant?.avatar_url ?? null;
  const date = conversation.last_message_at
    ? formatShortDate(conversation.last_message_at)
    : "";
  // Server returns `last_message` on some paths and `last_message_text` on
  // others — same fallback chain MessagesScreen uses (line 507).
  const preview =
    conversation.last_message ?? conversation.last_message_text ?? "No messages yet";
  const unread = conversation.unread_count ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={styles.conversationRow}
      accessibilityRole="button"
      accessibilityLabel={`Open chat with ${name}`}
    >
      {avatarUrl ? (
        <Image source={{ uri: avatarUrl }} style={styles.conversationAvatar} />
      ) : (
        <View style={[styles.conversationAvatar, styles.conversationAvatarFallback]}>
          <Text style={styles.conversationInitials}>{initials}</Text>
        </View>
      )}
      <View style={styles.conversationBody}>
        <View style={styles.conversationTopRow}>
          <Text style={styles.conversationName} numberOfLines={1}>
            {name}
          </Text>
          {date ? <Text style={styles.conversationDate}>{date}</Text> : null}
        </View>
        <Text style={styles.conversationPreview} numberOfLines={1}>
          {preview}
        </Text>
      </View>
      {unread > 0 ? (
        <View style={styles.conversationBadge}>
          <Text style={styles.conversationBadgeText}>{unread > 9 ? "9+" : unread}</Text>
        </View>
      ) : (
        <Ionicons name="chatbubble-outline" size={16} color={colors.subtleText} />
      )}
    </Pressable>
  );
}

function SkeletonRows({ count }: Readonly<{ count: number }>) {
  return (
    <View style={styles.sectionList}>
      {Array.from({ length: count }).map((_, i) => (
        <View key={i} style={styles.skeletonRow}>
          <View style={styles.skeletonAvatar} />
          <View style={styles.skeletonBody}>
            <View style={styles.skeletonNameBar} />
            <View style={styles.skeletonPreviewBar} />
          </View>
        </View>
      ))}
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  // Header
  headerRow: {
    marginTop: 12,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  headerActions: { flexDirection: "row", gap: 8 },
  muted: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  iconBadge: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    ...shadowSoft(),
  },
  badgeDot: {
    position: "absolute",
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.primary,
    right: 11,
    top: 11,
  },

  // Hero
  heroCard: {
    backgroundColor: colors.card,
    borderColor: colors.border,
    borderRadius: 22,
    marginBottom: 16,
    paddingHorizontal: 18,
    paddingVertical: 22,
    gap: 12,
  },
  heroBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: primaryTint.stroke20,
  },
  heroBadgeText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  heroAccent: { color: colors.primary },
  heroBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },

  // Action grid (3 cards stacked)
  actionGrid: { gap: 10, marginBottom: 18 },
  actionCard: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 4,
  },
  actionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  actionIconBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChevronCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChip: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  actionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  actionSubtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2, lineHeight: 16 },
  airplaneTilt: { transform: [{ rotate: "-42deg" }] },
  airplaneTiltIos: { transform: [{ rotate: "-42deg" }] },

  // Section headers
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 12,
  },
  sectionHeaderLeft: { flexDirection: "row", alignItems: "center", gap: 10, flex: 1 },
  sectionIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  sectionHeaderText: { flex: 1, minWidth: 0 },
  sectionTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  sectionSubtitle: { color: colors.mutedText, fontSize: 11, marginTop: 1 },
  seeAll: { color: colors.primary, fontSize: 12, fontWeight: "800" },

  // Section card
  sectionCard: {
    borderRadius: 18,
    paddingHorizontal: 8,
    paddingVertical: 8,
    marginBottom: 18,
  },
  sectionList: { gap: 6 },

  // Activity row
  activityRow: {
    paddingHorizontal: 12,
    paddingVertical: 12,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  activityTitle: { color: colors.text, fontSize: 13, fontWeight: "700", lineHeight: 18 },
  activityDescription: { color: colors.mutedText, fontSize: 12, marginTop: 4, lineHeight: 16 },
  activityDate: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginTop: 8,
  },

  // Conversation row
  conversationRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  conversationAvatar: { width: 40, height: 40, borderRadius: 20 },
  conversationAvatarFallback: {
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationInitials: { color: colors.primary, fontSize: 13, fontWeight: "800" },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  conversationName: { color: colors.text, fontSize: 14, fontWeight: "700", flex: 1 },
  conversationDate: { color: colors.subtleText, fontSize: 10, fontWeight: "600" },
  conversationPreview: { color: colors.mutedText, fontSize: 12, marginTop: 2 },
  conversationBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 6, paddingHorizontal: 18 },
  emptyTitle: { color: colors.text, fontSize: 14, fontWeight: "800" },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 12,
    textAlign: "center",
    maxWidth: 260,
    lineHeight: 16,
  },

  // Skeleton
  skeletonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
  },
  skeletonAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.border },
  skeletonBody: { flex: 1, gap: 8 },
  skeletonNameBar: { height: 12, width: "45%", borderRadius: 6, backgroundColor: colors.border },
  skeletonPreviewBar: {
    height: 10,
    width: "75%",
    borderRadius: 5,
    backgroundColor: colors.border,
    opacity: 0.7,
  },
});
