import { useCallback, useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LinearGradient } from "expo-linear-gradient";
import { Animated, Platform, StyleSheet, Text, View } from "react-native";

import { KycPromptDialog } from "@/components/kyc/KycPromptDialog";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import { getErrorMessage } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";
import { colors, primaryTint } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

// ── Activity + Messages sections are temporarily hidden. The data hooks,
//    helpers and JSX for them are kept (commented) so they can be re-enabled.
// import { useFocusEffect } from "@react-navigation/native";
// import { Image } from "react-native";
// import { useAuth } from "@/context/AuthContext";
// import { useActivityFeed } from "@/hooks/api/useActivityFeed";
// import { useMyConversations } from "@/hooks/api/useMyConversations";
// import { useUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
// import { type Conversation, type FeedItem } from "@/services/api";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "Home">,
  NativeStackNavigationProp<RootStackParamList>
>;

/** Gradient pairs per pillar — match the web home's colour-tinted icon tiles. */
const CARRIER_GRADIENT = ["#A74EFF", "#7C3AED"] as const;
const RECEIVE_GRADIENT = ["#22C35D", "#16A34A"] as const;
const BUDDY_GRADIENT = ["#F59F0A", "#EA8C0B"] as const;

// function getInitials(name?: string | null): string {
//   if (!name) return "?";
//   return name
//     .split(" ")
//     .map((w) => w[0])
//     .join("")
//     .toUpperCase()
//     .slice(0, 2);
// }

// /** "Mar 30" — same shape web uses on the activity card. */
// function formatShortDate(iso: string): string {
//   const d = new Date(iso);
//   if (Number.isNaN(d.getTime())) return "";
//   return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
// }

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const {
    profile,
    loading: profileLoading,
    error: profileError,
    refetch: refetchProfile,
  } = useMyProfile();

  // ── Activity + Messages data (temporarily hidden) ──
  // const { user } = useAuth();
  // const {
  //   items: activity,
  //   loading: activityLoading,
  //   error: activityError,
  //   refetch: refetchActivity,
  // } = useActivityFeed({ perPage: 4 });
  // const {
  //   conversations,
  //   loading: convsLoading,
  //   error: convsError,
  //   refetch: refetchConvs,
  // } = useMyConversations({ currentUserId: user?.id ?? null, perPage: 20 });
  // const { count: messagesUnread } = useUnreadInboxCount();

  // One-shot KYC welcome prompt: consume the flag immediately so it shows once.
  const kycWelcomePending = useAppStore((s) => s.kycWelcomePending);
  const setKycWelcomePending = useAppStore((s) => s.setKycWelcomePending);
  const [showKycWelcome, setShowKycWelcome] = useState(false);
  useEffect(() => {
    if (!kycWelcomePending) return;
    setShowKycWelcome(true);
    setKycWelcomePending(false);
  }, [kycWelcomePending, setKycWelcomePending]);

  const formError = profileError ? getErrorMessage(profileError) : null;

  const airplaneStyle = Platform.OS === "ios" ? styles.airplaneTiltIos : styles.airplaneTilt;

  // Web parity (`CustomerHome.tsx:46-50`): drop self-conversations + only
  // ones the dedupe layer recognises as a real participant.
  // const visibleConversations = useMemo(
  //   () =>
  //     conversations.filter(
  //       (c) =>
  //         c.participant_1 !== c.participant_2 &&
  //         c.participant?.id !== user?.id,
  //     ),
  //   [conversations, user?.id],
  // );

  // `&& !profile` keeps the name stable across realtime refetches that flip
  // `loading` after the first paint — otherwise the skeleton would flash back
  // every time the hook revalidates.
  const showGreetingSkeleton = profileLoading && !profile;
  const greetingName = profile?.name ?? "there";

  const handleRefresh = useCallback(() => {
    void refetchProfile();
    // void refetchActivity();
    // void refetchConvs();
  }, [refetchProfile]);

  // Refetch every time Home regains focus — covers the case where realtime
  // didn't fire while the user was elsewhere (e.g. in Settings).
  // useFocusEffect(
  //   useCallback(() => {
  //     void refetchActivity();
  //     void refetchConvs();
  //   }, [refetchActivity, refetchConvs]),
  // );

  // const openConversation = useCallback(
  //   (c: Conversation) => {
  //     navigation.navigate("OfferChatTab", {
  //       conversationId: c.id,
  //       name: c.participant?.name ?? "Conversation",
  //       source: "home",
  //     });
  //   },
  //   [navigation],
  // );

  // const renderActivityRow = (item: FeedItem) => (
  //   <Pressable
  //     key={item.id}
  //     onPress={() => navigation.navigate("Parcels")}
  //     style={styles.activityRow}
  //     accessibilityRole="button"
  //     accessibilityLabel={item.title}
  //   >
  //     <Text style={styles.activityTitle} numberOfLines={2}>
  //       {item.title}
  //     </Text>
  //     {item.description ? (
  //       <Text style={styles.activityDescription} numberOfLines={2}>
  //         {item.description}
  //       </Text>
  //     ) : null}
  //     <Text style={styles.activityDate}>
  //       {formatShortDate(item.created_at).toUpperCase()}
  //     </Text>
  //   </Pressable>
  // );

  return (
    <Screen onRefresh={handleRefresh}>
      {/* ───────── Header ───────── */}
      <View style={styles.headerRow}>
        <View style={styles.headerTextWrap}>
          <Text style={styles.muted}>Welcome back</Text>
          {showGreetingSkeleton ? (
            <View
              style={styles.titleSkeletonRow}
              accessibilityRole="progressbar"
              accessibilityLabel="Loading your name"
            >
              <PulseBar style={styles.titleSkeleton} />
            </View>
          ) : (
            <Text style={styles.title} numberOfLines={1}>
              {greetingName}
            </Text>
          )}
        </View>
        <PrimaryHeaderActions />
      </View>

      {formError ? (
        <View style={styles.bannerSlot}>
          <FormBanner message={formError} />
        </View>
      ) : null}

      {/* ───────── Hero ───────── */}
      <Card elevated={false} style={[styles.heroCard, shadowCard()]}>
        <View style={styles.heroBadge}>
          <Ionicons name="sparkles" size={12} color={colors.wordmark} />
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
          title="Carrier"
          subtitle="I'm traveling and can deliver parcels"
          icon="airplane-outline"
          iconStyle={airplaneStyle}
          tint={colors.wordmark}
          tintBg={colors.surfaceTintPrimary}
          gradient={CARRIER_GRADIENT}
          onPress={() => navigation.navigate("ListTripTab")}
        />
        <ActionCard
          chip="Match with travelers"
          title="Receive"
          subtitle="I need someone to bring me a package"
          icon="download"
          tint={colors.safe}
          tintBg={colors.surfaceTintSafe}
          gradient={RECEIVE_GRADIENT}
          onPress={() => navigation.navigate("SendParcelTab")}
        />
        <ActionCard
          chip="Community match"
          title="Travel Buddy"
          subtitle="Find companions for safe travel"
          icon="people-outline"
          tint={colors.warning}
          tintBg={colors.surfaceTintWarning}
          gradient={BUDDY_GRADIENT}
          onPress={() => navigation.navigate("CreateBuddyTab")}
        />
      </View>

      {/* ───────── Activity + Messages — temporarily hidden ─────────
      <View style={styles.sectionHeaderRow}>
        <View style={styles.sectionHeaderLeft}>
          <View style={[styles.sectionIcon, { backgroundColor: colors.surfaceTintPrimary }]}>
            <Ionicons name="flash-outline" size={16} color={colors.wordmark} />
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
            messagesUnread > 0 ? `Open inbox, ${messagesUnread} unread` : "Open inbox"
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
              <ConversationRow key={c.id} conversation={c} onPress={() => openConversation(c)} />
            ))}
          </View>
        )}
      </Card>
      ───────── end Activity + Messages ───────── */}

      <KycPromptDialog
        open={showKycWelcome}
        variant="welcome"
        onClose={() => setShowKycWelcome(false)}
        onVerify={() => {
          setShowKycWelcome(false);
          navigation.navigate("KycVerificationTab");
        }}
      />
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
  /**
   * Card surface. Must be OPAQUE — the card is elevated, and a translucent
   * background lets the shadow bleed through as a grey rectangle instead of
   * being clipped to the corner radius. Use the `surfaceTint*` theme tokens.
   */
  tintBg: string;
  /** Two-stop gradient for the icon tile (matches web's colour-tinted pillars). */
  gradient: readonly [string, string];
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
  gradient,
  onPress,
}: Readonly<ActionCardProps>) {
  return (
    <Pressable
      onPress={onPress}
      style={[styles.actionCard, { backgroundColor: tintBg }, shadowCard()]}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      <View style={styles.actionTopRow}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.actionIconBox}
        >
          <Ionicons name={icon} size={24} color={colors.white} style={iconStyle} />
        </LinearGradient>
        <View style={styles.actionChevronCircle}>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedText} />
        </View>
      </View>
      <Text style={[styles.actionChip, { color: tint }]}>{chip.toUpperCase()}</Text>
      <Text style={styles.actionTitle}>{title}</Text>
      <Text style={styles.actionSubtitle}>{subtitle}</Text>
    </Pressable>
  );
}

// interface ConversationRowProps {
//   conversation: Conversation;
//   onPress: () => void;
// }

// function ConversationRow({ conversation, onPress }: Readonly<ConversationRowProps>) {
//   const name = conversation.participant?.name ?? "Unknown";
//   const initials = getInitials(name);
//   const avatarUrl = conversation.participant?.avatar_url ?? null;
//   const date = conversation.last_message_at
//     ? formatShortDate(conversation.last_message_at)
//     : "";
//   const preview =
//     conversation.last_message ?? conversation.last_message_text ?? "No messages yet";
//   const unread = conversation.unread_count ?? 0;
//
//   return (
//     <Pressable
//       onPress={onPress}
//       style={styles.conversationRow}
//       accessibilityRole="button"
//       accessibilityLabel={`Open chat with ${name}`}
//     >
//       {avatarUrl ? (
//         <Image source={{ uri: avatarUrl }} style={styles.conversationAvatar} />
//       ) : (
//         <View style={[styles.conversationAvatar, styles.conversationAvatarFallback]}>
//           <Text style={styles.conversationInitials}>{initials}</Text>
//         </View>
//       )}
//       <View style={styles.conversationBody}>
//         <View style={styles.conversationTopRow}>
//           <Text style={styles.conversationName} numberOfLines={1}>
//             {name}
//           </Text>
//           {date ? <Text style={styles.conversationDate}>{date}</Text> : null}
//         </View>
//         <Text style={styles.conversationPreview} numberOfLines={1}>
//           {preview}
//         </Text>
//       </View>
//       {unread > 0 ? (
//         <View style={styles.conversationBadge}>
//           <Text style={styles.conversationBadgeText}>{unread > 9 ? "9+" : unread}</Text>
//         </View>
//       ) : (
//         <Ionicons name="chatbubble-outline" size={16} color={colors.subtleText} />
//       )}
//     </Pressable>
//   );
// }

function PulseBar({ style }: Readonly<{ style?: View["props"]["style"] }>) {
  const opacity = useRef(new Animated.Value(0.45)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.45, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => {
      loop.stop();
    };
  }, [opacity]);

  return <Animated.View style={[style, { opacity }]} />;
}

// function SkeletonRows({ count }: Readonly<{ count: number }>) {
//   return (
//     <View style={styles.sectionList}>
//       {Array.from({ length: count }).map((_, i) => (
//         <View key={i} style={styles.skeletonRow}>
//           <View style={styles.skeletonAvatar} />
//           <View style={styles.skeletonBody}>
//             <View style={styles.skeletonNameBar} />
//             <View style={styles.skeletonPreviewBar} />
//           </View>
//         </View>
//       ))}
//     </View>
//   );
// }

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  // Header
  headerRow: {
    marginTop: 16,
    marginBottom: 14,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
  },
  headerTextWrap: { flex: 1, minWidth: 0 },
  muted: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "600" },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  // `height` matches the title's lineHeight so swapping in the skeleton bar
  // doesn't shift surrounding content when the profile load finishes.
  titleSkeletonRow: { height: 30, justifyContent: "center" },
  titleSkeleton: {
    width: 160,
    height: 22,
    borderRadius: 8,
    backgroundColor: colors.border,
  },

  bannerSlot: { marginBottom: 14 },

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
  heroBadgeText: { color: colors.wordmark, fontSize: 11, fontWeight: "800", letterSpacing: 0.3 },
  heroTitle: { color: colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },
  heroAccent: { color: colors.wordmark },
  heroBody: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500" },

  // Action grid (3 cards stacked)
  actionGrid: { gap: 12, marginBottom: 18 },
  actionCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 4,
  },
  actionTopRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionIconBox: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChevronCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
  },
  actionChip: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.6,
    textTransform: "uppercase",
    marginBottom: 2,
  },
  actionTitle: { color: colors.text, fontSize: 17, lineHeight: 23, fontWeight: "800" },
  actionSubtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 2 },
  airplaneTilt: { transform: [{ rotate: "-42deg" }] },
  airplaneTiltIos: { transform: [{ rotate: "-42deg" }] },

  // Section headers (used by the hidden Activity + Messages sections)
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
  sectionTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  sectionSubtitle: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 2 },
  seeAll: { color: colors.ctaAccent, fontSize: 13, fontWeight: "700" },

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
  activityTitle: { color: colors.text, fontSize: 14, fontWeight: "700", lineHeight: 20 },
  activityDescription: { color: colors.mutedText, fontSize: 13, fontWeight: "500", marginTop: 4, lineHeight: 19 },
  activityDate: {
    color: colors.subtleText,
    fontSize: 11,
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
  conversationInitials: { color: colors.wordmark, fontSize: 14, fontWeight: "800" },
  conversationBody: { flex: 1, minWidth: 0 },
  conversationTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  conversationName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700", flex: 1 },
  conversationDate: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  conversationPreview: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 2 },
  conversationBadge: {
    minWidth: 22,
    height: 22,
    paddingHorizontal: 6,
    borderRadius: 11,
    backgroundColor: colors.wordmark,
    alignItems: "center",
    justifyContent: "center",
  },
  conversationBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },

  // Empty
  emptyState: { alignItems: "center", paddingVertical: 28, gap: 6, paddingHorizontal: 18 },
  emptyTitle: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  emptyBody: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 280,
    lineHeight: 19,
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
