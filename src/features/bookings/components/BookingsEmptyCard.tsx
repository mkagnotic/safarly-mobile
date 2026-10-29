import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { Card } from "@/components/ui/Card";
import { colors } from "@/theme/colors";
import type { Nav } from "@/features/bookings/lib/navigation";

/** Title per tab (FILTERS order): the empty state names the list that is empty. */
export const EMPTY_TITLES: readonly string[] = [
  "No bookings yet",
  "No active bookings",
  "No completed bookings",
  "No cancelled bookings",
];

/**
 * Empty list state, with browse CTAs when no filter is narrowing the list. Both
 * CTAs open Search (parcels / trips), not the user's OWN listings in My Travels.
 */
export function BookingsEmptyCard({
  filterIdx,
  navigation,
}: Readonly<{ filterIdx: number; navigation: Nav }>) {
  return (
    <Card style={styles.emptyCard}>
      <View style={styles.emptyIconBox}>
        <Ionicons name="cube-outline" size={28} color={colors.primary} />
      </View>
      <Text style={styles.emptyTitle}>{EMPTY_TITLES[filterIdx] ?? EMPTY_TITLES[0]}</Text>
      <Text style={styles.emptySubtitle}>
        {filterIdx > 0
          ? "Try a different filter."
          : "Browse parcels or trips to create your first booking."}
      </Text>
      {/* Web parity: empty-state CTAs (only when no filter is narrowing). */}
      {filterIdx === 0 ? (
        <View style={styles.emptyActions}>
          <Pressable
            onPress={() => navigation.navigate("Trips", { tab: "receiver", browse: true })}
            style={[styles.emptyActionButton, styles.emptyActionPrimary]}
            accessibilityRole="button"
            accessibilityLabel="Browse parcels"
          >
            <Text style={styles.emptyActionPrimaryText}>Browse parcels</Text>
          </Pressable>
          <Pressable
            onPress={() => navigation.navigate("Trips", { tab: "package", browse: true })}
            style={[styles.emptyActionButton, styles.emptyActionSecondary]}
            accessibilityRole="button"
            accessibilityLabel="Browse trips"
          >
            <Text style={styles.emptyActionSecondaryText}>Browse trips</Text>
          </Pressable>
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  emptyCard: {
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 300,
  },
  emptyActions: { flexDirection: "row", gap: 10, marginTop: 16 },
  emptyActionButton: {
    minHeight: 44,
    paddingHorizontal: 18,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyActionPrimary: { backgroundColor: colors.primary },
  emptyActionPrimaryText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  emptyActionSecondary: { backgroundColor: colors.surfaceMuted, borderWidth: 1, borderColor: colors.border },
  emptyActionSecondaryText: { color: colors.text, fontSize: 14, fontWeight: "800" },
});
