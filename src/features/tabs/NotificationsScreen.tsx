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
import { ListSkeleton } from "@/components/ui/Skeletons";
import { showAppAlert, showToast } from "@/feedback/appFeedback";
import { useMyNotifications } from "@/hooks/api/useMyNotifications";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, type Notification } from "@/services/api";
import { resolveNotificationRoute } from "@/services/notifications/notificationRoute";
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
  // Web parity: rating → Star (warning), system → Clock (primary).
  rating: { icon: "star", fg: colors.warning, bg: "rgba(245, 158, 11, 0.12)" },
  system: { icon: "time-outline", fg: colors.primary, bg: primaryTint.fill10 },
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
    clearing,
    loadingMore,
    refetch,
    loadMore,
    markAsRead,
    markAllAsRead,
    remove,
    clearAll,
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
      // Navigate off `data.link` when we recognise it, else fall back to a
      // per-type landing screen — shared with the OS push-tap handler via
      // `resolveNotificationRoute` (web parity: `resolveNotificationLink` +
      // `fallbackPathForType`). A tap always lands somewhere sensible.
      const link = (n.data as { link?: string } | null | undefined)?.link ?? "";
      const target = resolveNotificationRoute(link, n.type, n.title);
      // The screen name is a computed union the typed `navigate` can't verify;
      // every target is a real MainTab route, so use the loose signature.
      (navigation.navigate as (screen: string, params?: object) => void)(
        target.screen,
        target.params,
      );
    },
    [markAsRead, navigation],
  );

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await remove(id);
      } catch (err) {
        showToast({ title: "Couldn't delete", message: getErrorMessage(err), variant: "error" });
      }
    },
    [remove],
  );

  const handleClearAll = useCallback(() => {
    showAppAlert({
      title: "Clear all notifications?",
      message: "This removes every notification. This can't be undone.",
      actions: [
        { text: "Cancel", style: "cancel" },
        {
          text: "Clear all",
          style: "destructive",
          onPress: () => {
            void (async () => {
              try {
                await clearAll();
                showToast({ title: "Notifications cleared", variant: "info", duration: 1800 });
              } catch (err) {
                showToast({
                  title: "Couldn't clear",
                  message: getErrorMessage(err),
                  variant: "error",
                });
              }
            })();
          },
        },
      ],
    });
  }, [clearAll]);

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

  const hasAny = notifications.length > 0;
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
        {hasAny ? (
          <View style={styles.actionsRow}>
            {hasUnread ? (
              <Pressable
                onPress={() => void handleMarkAll()}
                disabled={markingAll}
                hitSlop={6}
                style={[styles.actionButton, markingAll && styles.markAllButtonDisabled]}
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
            ) : (
              <View />
            )}
            <Pressable
              onPress={handleClearAll}
              disabled={clearing}
              hitSlop={6}
              style={[styles.actionButton, clearing && styles.markAllButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Clear all notifications"
            >
              {clearing ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={14} color={colors.danger} />
                  <Text style={styles.clearAllText}>Clear all</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}
      </View>
    ),
    [handleBack, hasAny, hasUnread, handleMarkAll, markingAll, handleClearAll, clearing],
  );

  const keyExtractor = useCallback((item: Notification) => item.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Notification>) => (
      <NotificationRow
        item={item}
        onPress={() => void handleNotificationPress(item)}
        onDelete={() => void handleDelete(item.id)}
      />
    ),
    [handleNotificationPress, handleDelete],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return <ListSkeleton />;
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
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          onEndReached={() => void loadMore()}
          onEndReachedThreshold={0.4}
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
  onDelete: () => void;
}

const NotificationRow = memo(function NotificationRow({
  item,
  onPress,
  onDelete,
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
        </View>
        {item.body ? (
          <Text style={styles.cardDesc} numberOfLines={2}>
            {item.body}
          </Text>
        ) : null}
        {created ? <Text style={styles.cardTime}>{created.toUpperCase()}</Text> : null}
      </View>
      {/* Nested Pressable captures the touch, so deleting doesn't also open
          the notification (web parity: the trash icon stops propagation). */}
      <Pressable
        onPress={onDelete}
        hitSlop={8}
        style={styles.deleteButton}
        accessibilityRole="button"
        accessibilityLabel="Delete notification"
      >
        <Ionicons name="trash-outline" size={16} color={colors.subtleText} />
      </Pressable>
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

  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 4,
  },
  markAllButtonDisabled: { opacity: 0.6 },
  markAllText: { color: colors.primary, fontSize: 12, fontWeight: "800" },
  clearAllText: { color: colors.danger, fontSize: 12, fontWeight: "800" },
  footerLoading: { paddingVertical: 16, alignItems: "center" },

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
    // Centre the leading type icon (and trailing trash) vertically against the
    // text block so the card reads balanced rather than top-heavy.
    alignItems: "center",
  },
  // Unread = a soft lavender box (brand tint, no dot); read = plain white. The
  // fill MUST be opaque (`primarySoft`): this card carries a shadow, and a
  // translucent background makes Android paint a grey box behind the elevation.
  cardUnread: { backgroundColor: colors.primarySoft, borderColor: primaryTint.stroke20 },
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
  deleteButton: {
    padding: 4,
    marginLeft: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  cardTopRow: { flexDirection: "row", alignItems: "center" },
  cardTitle: { color: colors.text, fontSize: 15, fontWeight: "800", flex: 1 },
  cardDesc: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: 2 },
  cardTime: { color: colors.subtleText, fontSize: 10, fontWeight: "700", letterSpacing: 0.5, marginTop: 6 },
});
