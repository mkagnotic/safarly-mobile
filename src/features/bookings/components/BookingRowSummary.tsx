import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { bookingFee } from "@/features/bookings/paymentMath";
import type { Booking } from "@/services/api";
import { colors } from "@/theme/colors";
import { COMPACT_CONTROL_MAX_FONT_SCALE } from "@/theme/typography";
import { formatMoney } from "@/utils/money";
import { formatLocalDate } from "@/utils/travelDate";
import { PaymentExpiryCountdown } from "@/features/bookings/components/PaymentExpiryCountdown";
import {
  formatCategory,
  formatDate,
  STATUS_ICONS,
  STATUS_LABELS,
  STATUS_TONES,
} from "@/features/bookings/lib/bookingDisplay";

interface BookingRowSummaryProps {
  booking: Booking;
  role: "sender" | "carrier" | "unknown";
  expanded: boolean;
  onToggle: () => void;
}

/** The collapsed half of a booking row: route, role, date, pills, status and fee. */
export function BookingRowSummary({
  booking,
  role,
  expanded,
  onToggle,
}: Readonly<BookingRowSummaryProps>) {
  const tone = STATUS_TONES[booking.status] ?? { bg: "#E5E7EB", fg: colors.subtleText };
  const icon = STATUS_ICONS[booking.status] ?? "ellipse";
  const roleColor = role === "sender" ? colors.primary : "#F08020";

  return (
    <Pressable
      onPress={onToggle}
      style={styles.cardSummary}
      accessibilityRole="button"
      accessibilityLabel={`${expanded ? "Collapse" : "Expand"} booking ${booking.id}`}
      accessibilityState={{ expanded }}
    >
      {/* Header: route headline + chevron */}
      <View style={styles.cardHeader}>
        <View style={styles.cardHeaderMain}>
          <Text style={styles.routeText} numberOfLines={2}>
            {booking.parcel
              ? `${booking.parcel.from_city}  →  ${booking.parcel.to_city}`
              : "Booking"}
          </Text>
          <View style={styles.subRow}>
            {role !== "unknown" ? (
              <>
                <Ionicons
                  name={role === "sender" ? "person" : "car"}
                  size={12}
                  color={roleColor}
                />
                <Text style={[styles.roleText, { color: roleColor }]}>
                  {role === "sender" ? "Sender" : "Carrier"}
                </Text>
                <Text style={styles.subDot}>·</Text>
              </>
            ) : null}
            <Ionicons name="calendar-outline" size={12} color={colors.subtleText} />
            <Text style={styles.metaText} numberOfLines={1}>
              {formatDate(booking.created_at)}
            </Text>
            {booking.parcel?.category ? (
              <>
                <Text style={styles.subDot}>·</Text>
                <Ionicons name="pricetag-outline" size={12} color={colors.subtleText} />
                <Text style={styles.metaText} numberOfLines={1}>
                  {formatCategory(booking.parcel.category)}
                </Text>
              </>
            ) : null}
          </View>
        </View>
        <Ionicons
          name={expanded ? "chevron-up" : "chevron-down"}
          size={18}
          color={colors.mutedText}
        />
      </View>

      {/* Pills: payment countdown (pending) + agreed travel date (web parity) */}
      {(booking.status === "pending_payment" && booking.payment_expires_at) ||
      booking.agreed_travel_date ? (
        <View style={styles.cardPillsRow}>
          {booking.status === "pending_payment" && booking.payment_expires_at ? (
            <PaymentExpiryCountdown expiresAt={booking.payment_expires_at} />
          ) : null}
          {booking.agreed_travel_date ? (
            <View style={styles.travelDatePill}>
              <Ionicons name="airplane" size={11} color={colors.primary} />
              <Text style={styles.travelDateText}>
                {formatLocalDate(booking.agreed_travel_date, { month: "short", day: "numeric", locale: "en-US" })}
              </Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Footer: status + fee */}
      <View style={styles.cardFooter}>
        <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
          <Ionicons name={icon} size={11} color={tone.fg} />
          {/* Shrinks to fit rather than cutting the status ("CANCELLED MID-T…" at
              320pt + larger text, 23 Oct 2026); the fee wraps below if needed. */}
          <Text
            style={[styles.statusBadgeText, { color: tone.fg }]}
            numberOfLines={1}
            adjustsFontSizeToFit
            minimumFontScale={0.75}
            maxFontSizeMultiplier={COMPACT_CONTROL_MAX_FONT_SCALE}
          >
            {(STATUS_LABELS[booking.status] ?? booking.status.replace(/_/g, " ")).toUpperCase()}
          </Text>
        </View>
        {booking.parcel ? (
          <Text style={styles.feeText}>
            {formatMoney(bookingFee(booking), booking.parcel.fee_currency)}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  cardSummary: { padding: 16 },
  cardHeader: { flexDirection: "row", alignItems: "center", gap: 10 },
  cardHeaderMain: { flex: 1, minWidth: 0, gap: 5 },
  routeText: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "800",
    lineHeight: 21,
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    flexWrap: "wrap",
    rowGap: 2,
  },
  subDot: { color: colors.subtleText, fontSize: 12, fontWeight: "700" },
  roleText: { fontSize: 12, fontWeight: "800" },
  metaText: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },

  cardFooter: {
    flexDirection: "row",
    flexWrap: "wrap",
    rowGap: 6,
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexShrink: 1,
    minWidth: 0,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3, flexShrink: 1 },
  feeText: { color: colors.primary, fontSize: 16, fontWeight: "800" },

  // Card pills (payment countdown + agreed travel date)
  cardPillsRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  travelDatePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: colors.primarySoft,
  },
  travelDateText: { color: colors.primary, fontSize: 11, fontWeight: "700" },
});
