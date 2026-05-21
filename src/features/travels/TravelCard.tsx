import { memo, useCallback } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showAppAlert } from "@/feedback/appFeedback";
import {
  isImplicitStatus,
  isTerminal,
  labelForStatus,
  toneForStatus,
} from "@/features/travels/statusLabels";
import type { Parcel, Trip } from "@/services/api";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";

export type TravelCardType = "flight" | "parcel";

interface FlightItem extends Trip {
  luggage_capacity?: number;
}

interface Props {
  type: TravelCardType;
  item: FlightItem | Parcel;
  /** Tag chip shown at the top — caller supplies the descriptive label. */
  tag?: string;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export const TravelCard = memo(function TravelCard({
  type,
  item,
  tag,
  onPress,
  onEdit,
  onDelete,
  isDeleting,
}: Readonly<Props>) {
  const status = item.status ?? "";
  const tone = toneForStatus(status);
  const canModify = !isTerminal(status);
  const showStatusPill = !!status && !isImplicitStatus(status);
  const tagLabel = tag ?? (type === "flight" ? "TRIP LISTING" : "PARCEL");

  const metaLine =
    type === "flight"
      ? renderFlightMeta(item as FlightItem)
      : renderParcelMeta(item as Parcel);

  const handleDeletePress = useCallback(() => {
    if (!onDelete) return;
    showAppAlert({
      title: type === "flight" ? "Cancel this flight?" : "Remove this package?",
      message:
        `${item.from_city} → ${item.to_city}\n\n` +
        (type === "flight"
          ? "This will cancel your flight listing and remove it from search results. Any pending carrier requests will be withdrawn. This cannot be undone."
          : "This will cancel your package request and notify any interested carriers. You won't be able to restore it."),
      actions: [
        { text: "Keep it", style: "cancel" },
        {
          text: type === "flight" ? "Yes, cancel flight" : "Yes, remove package",
          style: "destructive",
          onPress: onDelete,
        },
      ],
    });
  }, [onDelete, type, item.from_city, item.to_city]);

  return (
    <Pressable
      onPress={onPress}
      style={[styles.card, shadowCard()]}
      accessibilityRole={onPress ? "button" : undefined}
      accessibilityLabel={`${tagLabel}: ${item.from_city} to ${item.to_city}`}
    >
      <View style={styles.tag}>
        <Text style={styles.tagText}>{tagLabel}</Text>
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
        </View>

        {canModify && (onEdit || onDelete) ? (
          <View style={styles.actionsCol}>
            {onEdit ? (
              <Pressable
                onPress={onEdit}
                style={styles.editButton}
                hitSlop={6}
                accessibilityRole="button"
                accessibilityLabel="Edit"
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
                accessibilityLabel="Delete"
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

      {showStatusPill ? (
        <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
          <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
            {labelForStatus(status)}
          </Text>
        </View>
      ) : null}
    </Pressable>
  );
});

function renderFlightMeta(trip: FlightItem): string {
  const date = formatLongDate(trip.travel_date);
  const airline = trip.airline?.trim();
  const cap = trip.luggage_capacity_kg ?? trip.luggage_capacity;
  const offers = trip.offers_count;
  return [
    date,
    airline,
    cap ? `${cap}kg capacity` : "",
    offers ? `${offers} offers` : "",
  ]
    .filter(Boolean)
    .join(" | ");
}

function renderParcelMeta(parcel: Parcel): string {
  const date = formatLongDate(parcel.delivery_by);
  const category = parcel.category?.trim();
  const weight = parcel.weight_kg != null ? `${parcel.weight_kg}kg` : "";
  const fee =
    parcel.fee_offered != null
      ? `${parcel.fee_currency === "USD" ? "$" : ""}${parcel.fee_offered}${
          parcel.fee_currency !== "USD" ? ` ${parcel.fee_currency}` : ""
        }`
      : "";
  return [date, category, weight, fee].filter(Boolean).join(" | ");
}

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
    marginTop: 10,
  },
  statusPillText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});
