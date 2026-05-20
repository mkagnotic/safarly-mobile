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
  /** Some normalized payloads expose the legacy `luggage_capacity` alias. */
  luggage_capacity?: number;
}

interface Props {
  type: TravelCardType;
  item: FlightItem | Parcel;
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
}

/** "Mar 18" — same shape as web's `toLocaleDateString({month, day})`. */
function shortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

/**
 * Generic card for the My Flights / My Packages tabs. Mirrors the web
 * `TripCard` component visual + functional shape, collapsed for mobile
 * (vertical layout, action icons inline).
 */
export const TravelCard = memo(function TravelCard({
  type,
  item,
  onPress,
  onEdit,
  onDelete,
  isDeleting,
}: Readonly<Props>) {
  const status = item.status ?? "";
  const tone = toneForStatus(status);
  const canModify = !isTerminal(status);
  const showStatusPill = !!status && !isImplicitStatus(status);

  const iconName: keyof typeof Ionicons.glyphMap =
    type === "flight" ? "airplane-outline" : "cube-outline";
  const iconColor = type === "flight" ? colors.wordmark : colors.safe;
  const iconBg =
    type === "flight" ? "rgba(167, 78, 255, 0.10)" : "rgba(34, 197, 94, 0.10)";

  const subtitle =
    type === "flight"
      ? renderFlightSubtitle(item as FlightItem)
      : renderParcelSubtitle(item as Parcel);

  const handleDeletePress = useCallback(() => {
    if (!onDelete) return;
    showAppAlert({
      title:
        type === "flight" ? "Cancel this flight?" : "Remove this package?",
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
      accessibilityLabel={`${type === "flight" ? "Flight" : "Parcel"}: ${item.from_city} to ${item.to_city}`}
    >
      <View style={[styles.iconWrap, { backgroundColor: iconBg }]}>
        <Ionicons
          name={iconName}
          size={18}
          color={iconColor}
          style={type === "flight" ? styles.flightIconTilt : undefined}
        />
      </View>

      <View style={styles.body}>
        <View style={styles.routeRow}>
          <Text style={styles.routeText} numberOfLines={2}>
            {item.from_city}
          </Text>
          <Ionicons name="arrow-forward" size={13} color={colors.mutedText} />
          <Text style={styles.routeText} numberOfLines={2}>
            {item.to_city}
          </Text>
        </View>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
        {showStatusPill ? (
          <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
            <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
              {labelForStatus(status)}
            </Text>
          </View>
        ) : null}
      </View>

      {canModify && (onEdit || onDelete) ? (
        <View style={styles.actionsColumn}>
          {onEdit ? (
            <Pressable
              onPress={onEdit}
              style={styles.actionButton}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Edit"
            >
              <Ionicons name="pencil-outline" size={16} color={colors.mutedText} />
            </Pressable>
          ) : null}
          {onDelete ? (
            <Pressable
              onPress={handleDeletePress}
              disabled={isDeleting}
              style={styles.actionButton}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel="Delete"
            >
              {isDeleting ? (
                <ActivityIndicator size="small" color={colors.mutedText} />
              ) : (
                <Ionicons name="trash-outline" size={16} color={colors.mutedText} />
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

function renderFlightSubtitle(trip: FlightItem): string {
  const cap = trip.luggage_capacity_kg ?? trip.luggage_capacity;
  const date = shortDate(trip.travel_date);
  const offers = typeof trip.offers_count === "number" ? `· ${trip.offers_count} offers` : "";
  return [date, cap ? `${cap}kg capacity` : "", offers].filter(Boolean).join(" · ");
}

function renderParcelSubtitle(parcel: Parcel): string {
  const parts = [parcel.category, parcel.weight_kg != null ? `${parcel.weight_kg}kg` : ""];
  if (parcel.fee_offered != null) {
    parts.push(`${parcel.fee_currency === "USD" ? "$" : ""}${parcel.fee_offered}${parcel.fee_currency !== "USD" ? ` ${parcel.fee_currency}` : ""}`);
  }
  return parts.filter(Boolean).join(" · ");
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 18,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 14,
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  flightIconTilt: { transform: [{ rotate: "-42deg" }] },
  body: { flex: 1, minWidth: 0, gap: 4 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  routeText: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "700", flexShrink: 1 },
  subtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500" },
  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 6,
  },
  statusPillText: { fontSize: 10, lineHeight: 14, fontWeight: "800", letterSpacing: 0.4, textTransform: "uppercase" },
  actionsColumn: { flexDirection: "row", alignItems: "center", gap: 2, marginLeft: 4 },
  actionButton: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
  },
});
