import { memo, useCallback, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { useMyNotifications } from "@/hooks/api/useMyNotifications";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, type Notification } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

type NotificationsNav = BottomTabNavigationProp<MainTabParamList, "Notifications">;

interface TypeStyle {
  icon: keyof typeof Ionicons.glyphMap;
  fg: string;
  bg: string;
}

/**
 * Mirrors `iconForType` + `colorForType` on web's CustomerNotifications.
 * Lucide icons mapped to closest Ionicons; semantic colors come from the
 * shared theme so they stay consistent with web's palette intent.
 */
const TYPE_STYLES: Readonly<Record<string, TypeStyle>> = {
  message: { icon: "chatbox-outline", fg: colors.primary, bg: primaryTint.fill10 },
  booking: { icon: "cube-outline", fg: colors.safe, bg: "rgba(34, 197, 94, 0.10)" },
  payment: { icon: "cash-outline", fg: colors.warning, bg: "rgba(245, 158, 11, 0.12)" },
  kyc: { icon: "shield-checkmark-outline", fg: colors.primary, bg: "rgba(255, 122, 38, 0.10)" },
  dispute: { icon: "alert-circle", fg: colors.danger, bg: "rgba(239, 68, 68, 0.10)" },
  buddy: { icon: "people-outline", fg: colors.text, bg: colors.surfaceMuted },
};

const DEFAULT_STYLE: TypeStyle = {
  icon: "notifications-outline",
  fg: colors.mutedText,
  bg: colors.surfaceMuted,
};

function styleForType(type: string): TypeStyle {
  return TYPE_STYLES[type] ?? DEFAULT_STYLE;
}

/** "Mar 18, 2026" — same shape as web's `toLocaleDateString` call. */
function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function NotificationsScreen() {
  const navigation = useNavigation<NotificationsNav>();
  const {
    notifications,
    loading,
    error,
    markingAll,
    refetch,
    markAsRead,
    markAllAsRead,
  } = useMyNotifications({ perPage: 20 });

  const hasUnread = useMemo(() => notifications.some((n) => !n.read), [notifications]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleNotificationPress = useCallback(
    async (n: Notification) => {
      // Optimistic — UI flips before the PUT lands.
      if (!n.read) {
        try {
          await markAsRead(n.id);
        } catch (err) {
          showToast({
            title: "Couldn't mark as read",
            message: getErrorMessage(err),
            variant: "error",
          });
        }
      }
      // Web parity (`useRealtimeSync.ts:42-49` + Index.tsx:126): notifications
      // carry `data.link`, e.g. `/customer/messages/{convId}` for chat events.
      // Mobile maps the supported subset directly to tab routes. Unknown
      // links no-op silently — better than a broken navigation.
      const link = (n.data as { link?: string } | null | undefined)?.link;
      if (!link) return;
      const messagesMatch = link.match(/^\/customer\/messages\/([0-9a-f-]{36})/i);
      if (messagesMatch) {
        navigation.navigate("OfferChatTab", {
          conversationId: messagesMatch[1],
          name: n.title?.replace(/^New message from /i, "") ?? "Conversation",
          source: "messages",
        });
        return;
      }
      const bookingsMatch = link.match(/^\/customer\/bookings\/([0-9a-f-]{36})/i);
      if (bookingsMatch) {
        // Web parity: `/customer/bookings/:id` is not a real route in web —
        // there's no `CustomerBookingDetail` page. The list page uses inline
        // expandable cards, so we navigate to the list and pass `expandId` so
        // the matching row auto-opens.
        navigation.navigate("BookingsTab", { expandId: bookingsMatch[1] });
        return;
      }
      if (link.startsWith("/customer/messages")) {
        navigation.navigate("MessagesTab");
        return;
      }
      if (link.startsWith("/customer/bookings")) {
        navigation.navigate("BookingsTab");
      }
    },
    [markAsRead, navigation],
  );

  const handleMarkAll = useCallback(async () => {
    try {
      await markAllAsRead();
      showToast({ title: "All caught up", variant: "success", duration: 2000 });
    } catch (err) {
      showToast({
        title: "Couldn't mark all as read",
        message: getErrorMessage(err),
        variant: "error",
      });
    }
  }, [markAllAsRead]);

  const listHeader = useMemo(
    () => (
      <View>
        <View style={styles.headerRow}>
          <Pressable
            style={styles.backButton}
            onPress={handleBack}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Ionicons name="chevron-back" size={18} color={colors.text} />
          </Pressable>
          <Text style={styles.title}>Notifications</Text>
        </View>
        {hasUnread ? (
          <View style={styles.markAllRow}>
            <Pressable
              onPress={() => void handleMarkAll()}
              disabled={markingAll}
              hitSlop={6}
              style={[styles.markAllButton, markingAll && styles.markAllButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Mark all as read"
            >
              {markingAll ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <>
                  <Ionicons name="checkmark-done" size={14} color={colors.primary} />
                  <Text style={styles.markAllText}>Mark all as read</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [handleBack, hasUnread, handleMarkAll, markingAll],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Notification>) => (
      <NotificationRow item={item} onPress={() => void handleNotificationPress(item)} />
    ),
    [handleNotificationPress],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading notifications…</Text>
        </View>
      );
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load notifications</Text>
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
          <Ionicons name="notifications-outline" size={22} color={colors.primary} />
        </View>
        <Text style={styles.emptyTitle}>You're all caught up!</Text>
        <Text style={styles.emptySubtitle}>No new notifications right now.</Text>
      </View>
    );
  }, [loading, error, refetch]);

  return (
    <Screen scroll={false} edges={["top", "left", "right"]}>
      <View style={styles.page}>
        <FlatList
          data={notifications}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={[styles.listContent, notifications.length === 0 && styles.listContentEmpty]}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={loading && notifications.length > 0}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          // Perf: list recycling is fine for ~20 items, but keep these conservative.
          windowSize={7}
          initialNumToRender={10}
          maxToRenderPerBatch={8}
        />
      </View>
    </Screen>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

interface NotificationRowProps {
  item: Notification;
  onPress: () => void;
}

const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
}: Readonly<NotificationRowProps>) {
  const unread = !item.read;
  const style = styleForType(item.type);
  const created = formatDate(item.created_at);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, shadowCard(), unread ? styles.cardUnread : styles.cardRead]}
      accessibilityRole="button"
      accessibilityLabel={`${unread ? "Unread: " : ""}${item.title}`}
    >
      <View style={[styles.typeIconWrap, { backgroundColor: style.bg }]}>
        <Ionicons name={style.icon} size={16} color={style.fg} />
      </View>
      <View style={styles.cardBody}>
        <View style={styles.cardTopRow}>
          <Text style={styles.cardTitle} numberOfLines={1}>
            {item.title}
          </Text>
          {unread ? <View style={styles.unreadDot} /> : null}
        </View>
        {item.body ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        {created ? <Text style={styles.cardTime}>{created.toUpperCase()}</Text> : null}
      </View>
    </Pressable>
  );
});

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20 },
  listContent: { paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },

  // Header
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 14,
    minHeight: 34,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800", lineHeight: 28 },

  markAllRow: { alignItems: "flex-end", marginBottom: 12 },
  markAllButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  markAllButtonDisabled: { opacity: 0.6 },
  markAllText: { color: colors.primary, fontSize: 12, fontWeight: "800" },

  // Loading / error / empty
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
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
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800" },
  emptySubtitle: { color: colors.subtleText, fontSize: 13, fontWeight: "500" },

  // Card
  card: {
    borderRadius: 16,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 10,
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  cardUnread: { backgroundColor: "#FFF9F7", borderColor: "#FFE0D8" },
  cardRead: { backgroundColor: colors.card, borderColor: colors.border },
  typeIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  cardBody: { flex: 1, minWidth: 0 },
  cardTopRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1, paddingRight: 8 },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
  cardDesc: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardTime: { color: colors.subtleText, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 6 },
});
