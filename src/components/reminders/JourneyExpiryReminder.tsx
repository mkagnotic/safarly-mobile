import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { AppButton } from "@/components/ui/AppButton";
import { useMyNotifications } from "@/hooks/api/useMyNotifications";
import { navigateToNotificationTarget } from "@/services/notifications/push";
import { resolveNotificationRoute } from "@/services/notifications/notificationRoute";
import { type Notification } from "@/services/api";
import { colors } from "@/theme/colors";

// One-time reminder modal for the `journey_expiry` notices produced by the
// scheduled-journey-expiry backend (web parity with `JourneyExpiryReminder`).
// Each notice is marked "seen" (AsyncStorage) the instant it displays, so it
// shows exactly once; the notification + email stay the durable record. A
// newly-expiring item later gets its own one-time popup.
const SEEN_KEY = "safarly.expiryNoticesSeen.v1";

function isExpiryNotice(n: Notification): boolean {
  return !n.read && (n.data as { kind?: string } | null)?.kind === "journey_expiry";
}

async function readSeen(): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(SEEN_KEY);
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

async function persistSeen(ids: Set<string>): Promise<void> {
  try {
    await AsyncStorage.setItem(SEEN_KEY, JSON.stringify([...ids]));
  } catch {
    /* storage unavailable — the popup may reappear next launch */
  }
}

/**
 * Mounted once for the authenticated app (see RootNavigator). Reads the user's
 * notifications, and on first load pops a single modal listing every unseen
 * `journey_expiry` notice, then marks them seen.
 */
export function JourneyExpiryReminder() {
  const { notifications, loading } = useMyNotifications({ perPage: 50 });
  const [items, setItems] = useState<Notification[] | null>(null);
  const [closed, setClosed] = useState(false);
  const decidedRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    // Decide exactly once, after notifications first finish loading.
    if (decidedRef.current || loading) return;
    decidedRef.current = true;
    void (async () => {
      const seen = await readSeen();
      const fresh = notifications.filter((n) => isExpiryNotice(n) && !seen.has(n.id));
      if (fresh.length > 0) {
        const next = new Set(seen);
        fresh.forEach((n) => next.add(n.id));
        await persistSeen(next);
      }
      if (mountedRef.current) setItems(fresh);
    })();
  }, [loading, notifications]);

  if (closed || !items || items.length === 0) return null;

  const close = () => setClosed(true);

  const view = (n: Notification) => {
    const type = (n.data as { type?: string } | null)?.type ?? null;
    const target = resolveNotificationRoute(n.data?.link, type, n.title);
    close();
    navigateToNotificationTarget(target);
  };

  const heading = items.length > 1 ? `${items.length} journeys need your attention` : items[0].title;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={close}>
      <Pressable style={styles.backdrop} onPress={close} accessibilityRole="button" accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="alarm-outline" size={20} color={colors.primary} />
            </View>
            <Text style={styles.title} numberOfLines={2}>{heading}</Text>
            <Pressable onPress={close} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {items.slice(0, 5).map((n) => (
              <Pressable key={n.id} style={styles.item} onPress={() => view(n)} accessibilityRole="button" accessibilityLabel={n.title}>
                <Text style={styles.itemTitle} numberOfLines={1}>{n.title}</Text>
                {n.body ? <Text style={styles.itemBody} numberOfLines={2}>{n.body}</Text> : null}
              </Pressable>
            ))}
            {items.length > 5 ? (
              <Text style={styles.more}>+{items.length - 5} more in your notifications.</Text>
            ) : null}
          </ScrollView>

          <View style={styles.footer}>
            <AppButton label="Dismiss" variant="secondary" onPress={close} style={styles.footerButton} />
            <AppButton
              label="View my travels"
              onPress={() => view(items[0])}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.45)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { flex: 1, color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "800" },

  list: { maxHeight: 260 },
  listContent: { gap: 10 },
  item: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  itemTitle: { color: colors.text, fontSize: 14, fontWeight: "700" },
  itemBody: { color: colors.mutedText, fontSize: 12, lineHeight: 17, marginTop: 3 },
  more: { color: colors.subtleText, fontSize: 12, marginTop: 2 },

  footer: { flexDirection: "row", gap: 10 },
  footerButton: { flex: 1 },
});
