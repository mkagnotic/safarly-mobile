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
  onPress?: () => void;
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
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" };
  const fromLabel = new Date(from).toLocaleDateString(undefined, opts);
  if (!to || from === to) return fromLabel;
  return `${fromLabel} - ${new Date(to).toLocaleDateString(undefined, opts)}`;
}

export const BuddyPartnerCard = memo(function BuddyPartnerCard({
  item,
  onPress,
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
        : { bg: "rgba(249, 115, 22, 0.10)", fg: colors.ctaAccent },
    [isMatched],
  );

  const metaLine = useMemo(() => {
    const range = formatDateRange(item);
    const airline = item.airline?.trim();
    return [range, airline].filter(Boolean).join(" | ");
  }, [item]);

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
    <Pressable
      onPress={onPress}
      style={[styles.card, shadowCard()]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`Travel buddy request: ${item.from_city} to ${item.to_city}`}
    >
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
          {metaLine ? (
            <Text style={styles.metaText} numberOfLines={2}>
              {metaLine}
            </Text>
          ) : null}
          {/* Inside the text column, not below the row: the stacked Edit/Delete
              column is taller than this text, so a pill placed after the row
              inherited that height and left a large gap under the meta line. */}
          <View style={[styles.statusPill, { backgroundColor: statusTone.bg }]}>
            <Text style={[styles.statusPillText, { color: statusTone.fg }]} numberOfLines={1}>
              {statusLabel}
            </Text>
          </View>
        </View>

        {onEdit || onDelete ? (
          <View style={styles.actionsCol}>
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                style={styles.editButton}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Edit listing"
              >
                <Text style={styles.editText}>Edit</Text>
              </Pressable>
            ) : null}
            {onDelete ? (
              <Pressable
                onPress={handleDeletePress}
                disabled={isDeleting}
                style={styles.deleteButton}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Delete listing"
              >
                {isDeleting ? (
                  <ActivityIndicator size="small" color={colors.danger} />
                ) : (
                  <Text style={styles.deleteText}>Delete</Text>
                )}
              </Pressable>
            ) : null}
          </View>
        ) : null}
      </View>

      {item.bio ? (
        <Text style={styles.bio} numberOfLines={2}>
          {item.bio}
        </Text>
      ) : null}
    </Pressable>
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
    backgroundColor: "rgba(249, 115, 22, 0.10)",
    marginBottom: 10,
  },
  tagText: {
    color: colors.ctaAccent,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bodyCol: { flex: 1, minWidth: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  routeText: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", flexShrink: 1 },
  metaText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 4 },
  actionsCol: { gap: 8, alignItems: "flex-end" },
  editButton: {
    minWidth: 76,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  editText: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  deleteButton: {
    minWidth: 76,
    minHeight: 34,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(220, 40, 40, 0.32)",
    backgroundColor: "rgba(220, 40, 40, 0.06)",
    alignItems: "center",
    justifyContent: "center",
  },
  deleteText: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
  },
  statusPillText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
  bio: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 10 },
});
