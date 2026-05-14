import { memo, useCallback, useMemo } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showAppAlert } from "@/feedback/appFeedback";
import type { BuddyListing } from "@/services/api";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

interface Props {
  item: BuddyListing;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

const MATCHED_STATUSES: ReadonlySet<string> = new Set([
  "matched",
  "accepted",
  "in_transit",
  "completed",
  "delivered",
]);

function formatDateRange(item: BuddyListing): string {
  const from = item.travel_date_from ?? item.travel_date;
  const to = item.travel_date_to ?? item.travel_date;
  if (!from) return "";
  const fromLabel = new Date(from).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  if (!to || from === to) return fromLabel;
  const toLabel = new Date(to).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
  return `${fromLabel} - ${toLabel}`;
}

/**
 * Mirrors web's `BuddyPartnerCard` from CustomerMyTrips. Renders a buddy
 * listing with status pill (Matched / Looking for Match), edit + delete
 * actions, and a destructive-confirm modal for delete.
 */
export const BuddyPartnerCard = memo(function BuddyPartnerCard({
  item,
  onEdit,
  onDelete,
  isDeleting,
}: Readonly<Props>) {
  const rawStatus = (item.status ?? "").toLowerCase();
  const isMatched = MATCHED_STATUSES.has(rawStatus);
  const statusLabel = isMatched ? "Matched" : "Looking for Match";
  const statusTone = useMemo(
    () =>
      isMatched
        ? { bg: "rgba(34, 197, 94, 0.10)", fg: colors.safe }
        : { bg: "rgba(245, 158, 11, 0.12)", fg: colors.warning },
    [isMatched],
  );

  const dateRange = useMemo(() => formatDateRange(item), [item]);

  const handleDeletePress = useCallback(() => {
    if (!onDelete) return;
    showAppAlert({
      title: "Remove this travel buddy listing?",
      message:
        `${item.from_city} → ${item.to_city}\n\n` +
        "This will remove your travel buddy request from search and My Travels.",
      actions: [
        { text: "Keep listing", style: "cancel" },
        { text: "Yes, delete listing", style: "destructive", onPress: onDelete },
      ],
    });
  }, [onDelete, item.from_city, item.to_city]);

  return (
    <View style={[styles.card, shadowCard()]}>
      <View style={styles.tag}>
        <Text style={styles.tagText}>TRAVEL BUDDY REQUEST</Text>
      </View>

      <View style={styles.row}>
        <View style={styles.bodyCol}>
          <View style={styles.routeRow}>
            <Text style={styles.routeText} numberOfLines={2}>
              {item.from_city}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.mutedText} />
            <Text style={styles.routeText} numberOfLines={2}>
              {item.to_city}
            </Text>
          </View>
          <Text style={styles.dateText} numberOfLines={2}>
            {dateRange}
            {item.airline ? ` | ${item.airline}` : ""}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
            <Text style={[styles.statusPillText, { color: statusTone.fg }]}>
              {statusLabel}
            </Text>
          </View>
          {item.bio ? (
            <Text style={styles.bio} numberOfLines={2}>
              {item.bio}
            </Text>
          ) : null}
        </View>

        <View style={styles.actionsCol}>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              style={styles.smallButton}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Edit listing"
            >
              <Ionicons name="pencil-outline" size={13} color={colors.text} />
              <Text style={styles.smallButtonText}>Edit</Text>
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={handleDeletePress}
              disabled={isDeleting}
              style={[styles.smallButton, styles.destructiveButton]}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel="Delete listing"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.danger} />
              ) : (
                <>
                  <Ionicons name="trash-outline" size={13} color={colors.danger} />
                  <Text style={[styles.smallButtonText, styles.destructiveText]}>Delete</Text>
                </>
              )}
            </Pressable>
          ) : null}
        </View>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  tag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(255, 122, 38, 0.10)",
    marginBottom: 10,
  },
  tagText: { color: colors.primary, fontSize: 10, fontWeight: "800", letterSpacing: 0.5 },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bodyCol: { flex: 1, minWidth: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeText: { color: colors.text, fontSize: 16, fontWeight: "800", flexShrink: 1 },
  dateText: { color: colors.mutedText, fontSize: 13, marginTop: 4, fontWeight: "500" },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusPillText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  bio: { color: colors.mutedText, fontSize: 13, lineHeight: 18, marginTop: 8 },
  actionsCol: { gap: 6 },
  smallButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
  },
  destructiveButton: { borderColor: "rgba(239, 68, 68, 0.30)" },
  smallButtonText: { color: colors.text, fontSize: 12, fontWeight: "700" },
  destructiveText: { color: colors.danger },
});
