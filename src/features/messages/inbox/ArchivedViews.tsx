import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

import { inboxStyles } from "./inboxStyles";

// ───────────────────────── Archived section (WhatsApp-style) ─────────────────────────

/** Tappable banner at the top of the inbox that opens the Archived list. */
export function ArchivedBanner({ count, onPress }: Readonly<{ count: number; onPress: () => void }>) {
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
export function ArchivedHeader({ count, onBack }: Readonly<{ count: number; onBack: () => void }>) {
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

export function ArchivedEmpty() {
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

const archivedStyles = StyleSheet.create({
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
});

const styles = { ...inboxStyles, ...archivedStyles };
