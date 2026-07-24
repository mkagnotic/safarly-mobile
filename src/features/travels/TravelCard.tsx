import { memo, useCallback, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showAppAlert } from "@/feedback/appFeedback";
import {
  isImplicitStatus,
  isListingExpired,
  isTerminal,
  labelForStatus,
  toneForStatus,
} from "@/features/travels/statusLabels";
import type { Parcel, Trip } from "@/services/api";
import { colors } from "@/theme/colors";
import { shadowCard } from "@/theme/elevation";
import { formatDeliveryWindow, formatTravelDateRange } from "@/utils/travelDate";

export type TravelCardType = "flight" | "parcel";

interface FlightItem extends Trip {
  luggage_capacity?: number;
}

interface Props {
  type: TravelCardType;
  item: FlightItem | Parcel;
  /** Tag chip shown at the top — caller supplies the descriptive label. */
  tag?: string;
  /**
   * Tag colour. "muted" for archived/terminal records, where the accent orange
   * reads as an active listing demanding attention.
   */
  tagTone?: "accent" | "muted";
  onPress?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
  isDeleting?: boolean;
  /** When set and the listing is matched/accepted, the status pill opens the matches view. */
  onViewMatches?: () => void;
  /**
   * The matched sender/carrier on the other side of this parcel. Renders a
   * footer row with a Chat entry point, mirroring web's `TripCard`.
   */
  counterpart?: { id?: string; name?: string | null } | null;
  /** Label for the counterpart's role, e.g. "carrier" / "sender". */
  counterpartRole?: string;
  onChat?: () => void;
  chatPending?: boolean;
  /**
   * Rendered inside the card below the status pill — used for the parcel journey
   * tracker, which web draws inside the same card rather than as a sibling.
   */
  footer?: ReactNode;
}

function initialsOf(name?: string | null): string {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return parts
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

export const TravelCard = memo(function TravelCard({
  type,
  item,
  tag,
  tagTone = "accent",
  onPress,
  onEdit,
  onDelete,
  isDeleting,
  onViewMatches,
  counterpart,
  counterpartRole = "carrier",
  onChat,
  chatPending,
  footer,
}: Readonly<Props>) {
  const status = item.status ?? "";
  const tone = toneForStatus(status);
  const canModify = !isTerminal(status);
  // Flights expire at the END of the travel window (web parity: travel_date_to
  // || travel_date), so a multi-day trip isn't marked expired while still ongoing.
  const expiryDate =
    type === "parcel"
      ? (item as Parcel).delivery_by
      : ((item as FlightItem & { travel_date_to?: string | null }).travel_date_to ??
        (item as FlightItem).travel_date);
  const expired = isListingExpired(status, expiryDate);
  const showStatusPill = !expired && !!status && !isImplicitStatus(status);
  // A matched/accepted listing's badge opens the list of matching counterparts.
  const matchClickable =
    showStatusPill && !!onViewMatches && (status === "matched" || status === "accepted");
  const tagLabel = tag ?? (type === "flight" ? "TRIP LISTING" : "PARCEL");
  const hasActions = canModify && !!(onEdit || onDelete);

  /** Status chip — placed under the text or in the right column, see below. */
  const statusNode = expired ? (
    <View style={styles.expiredPill}>
      <Ionicons name="calendar-clear-outline" size={11} color={colors.mutedText} />
      <Text style={styles.expiredPillText}>EXPIRED</Text>
    </View>
  ) : matchClickable ? (
    <Pressable
      onPress={onViewMatches}
      style={[styles.statusPill, styles.statusPillRow, { backgroundColor: tone.bg }]}
      accessibilityRole="button"
      accessibilityLabel={`${labelForStatus(status)} — view matches`}
    >
      <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
        {labelForStatus(status)}
      </Text>
      <Ionicons name="people" size={11} color={tone.fg} />
    </Pressable>
  ) : showStatusPill ? (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
        {labelForStatus(status)}
      </Text>
    </View>
  ) : null;

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
      <View style={[styles.tag, tagTone === "muted" && styles.tagMuted]}>
        <Text style={[styles.tagText, tagTone === "muted" && styles.tagTextMuted]}>{tagLabel}</Text>
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

          {/* With actions present, the status sits under the text: the stacked
              Edit/Delete column is taller, so a pill placed after the row
              inherited that height and left a big gap under the meta line. */}
          {hasActions ? statusNode : null}
        </View>

        {/* Without actions (archived/closed records) the right column would be
            dead space, so the status takes it — matching web, which renders the
            status badge at the right of the card header. */}
        {!hasActions && statusNode ? (
          <View style={styles.statusCol}>{statusNode}</View>
        ) : null}

        {hasActions ? (
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

      {counterpart ? (
        <View style={styles.counterpartRow}>
          <View style={styles.counterpartAvatar}>
            <Text style={styles.counterpartAvatarText}>{initialsOf(counterpart.name)}</Text>
          </View>
          <View style={styles.counterpartCol}>
            <Text style={styles.counterpartName} numberOfLines={1}>
              {counterpart.name || "Unknown user"}
            </Text>
            <Text style={styles.counterpartRole}>Matched {counterpartRole}</Text>
          </View>
          {onChat ? (
            <Pressable
              onPress={onChat}
              disabled={chatPending}
              style={styles.chatButton}
              accessibilityRole="button"
              accessibilityLabel={`Chat with ${counterpart.name || "your match"}`}
            >
              {chatPending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.chatButtonText}>Chat</Text>
              )}
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {footer}
    </Pressable>
  );
});

function renderFlightMeta(trip: FlightItem): string {
  const date = formatTravelDateRange(trip, { year: true });
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
  const date = formatDeliveryWindow(parcel, { year: true });
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
  tagMuted: { backgroundColor: colors.surfaceMuted },
  tagTextMuted: { color: colors.subtleText },
  row: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  bodyCol: { flex: 1, minWidth: 0 },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  routeText: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", flexShrink: 1 },
  metaText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 4 },
  actionsCol: { gap: 8, alignItems: "flex-end", alignSelf: "center" },
  /** Right-column home for the status chip when there are no action buttons. */
  statusCol: { alignItems: "flex-end", flexShrink: 0 },
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
  statusPillRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  expiredPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 999,
    marginTop: 8,
    backgroundColor: colors.surfaceMuted,
  },
  expiredPillText: {
    color: colors.mutedText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  statusPillText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  // ───── Matched counterpart footer (web `TripCard`'s counterpart row) ─────
  counterpartRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  counterpartAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  counterpartAvatarText: {
    color: colors.wordmark,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
  },
  counterpartCol: { flex: 1, minWidth: 0 },
  counterpartName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700" },
  counterpartRole: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  chatButton: {
    minWidth: 84,
    minHeight: 36,
    paddingHorizontal: 18,
    borderRadius: 999,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  chatButtonText: { color: colors.white, fontSize: 13, lineHeight: 18, fontWeight: "800" },
});
