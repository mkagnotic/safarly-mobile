import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { JourneySummaryRow } from "@/features/travels/ParcelJourneyTracker";
import type { Booking, BuddyConnection, Parcel } from "@/services/api";
import { colors } from "@/theme/colors";

export function ArchiveBookingCard({
  booking,
  parcel,
  myUserId,
  onRate,
  onOpen,
}: Readonly<{
  booking: Booking;
  /** Resolved parcel, when loaded — gives the tracker its pre-booking fallback. */
  parcel?: Parcel | null;
  myUserId: string | null;
  onRate: () => void;
  /** Opens the delivery details screen, where the full timeline lives. */
  onOpen: () => void;
}>) {
  const isSender = !!myUserId && booking.sender_id === myUserId;
  const counterpart = isSender ? booking.carrier : booking.sender;
  const roleLabel = isSender ? "Carrier" : "Sender";
  const route = booking.parcel
    ? `${booking.parcel.from_city} → ${booking.parcel.to_city}`
    : "Delivery";
  const deliveredOn = booking.delivered_at
    ? new Date(booking.delivered_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <Pressable
      style={styles.archiveCard}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Delivery details: ${route}`}
    >
      <View style={styles.archiveTag}>
        <Text style={styles.archiveTagText}>DELIVERED</Text>
      </View>
      <Text style={styles.archiveRoute} numberOfLines={2}>
        {route}
      </Text>
      {deliveredOn ? (
        <Text style={styles.archiveMeta}>Delivered · {deliveredOn}</Text>
      ) : null}
      <View style={styles.archiveFooter}>
        <View style={styles.archivePersonCol}>
          <Text style={styles.archiveRole}>{roleLabel}</Text>
          <Text style={styles.archivePersonName} numberOfLines={1}>
            {counterpart?.name || "Unknown user"}
          </Text>
        </View>
        {/* Ratings are one-per (author, booking): offering "Rate" again after
            the viewer has rated just fails with CONFLICT. */}
        {booking.viewer_has_rated ? (
          <View style={styles.ratedChip}>
            <Ionicons name="star" size={13} color={colors.safe} />
            <Text style={styles.ratedChipText}>Rated</Text>
          </View>
        ) : (
          <AppButton
            label={`Rate ${roleLabel}`}
            onPress={onRate}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.archiveRateBtn}
          />
        )}
      </View>
      {/* Summary only — the full timeline lives on the details screen. */}
      <JourneySummaryRow parcel={parcel} booking={booking} />
    </Pressable>
  );
}

export function ArchiveBuddyCard({
  connection,
  onRate,
}: Readonly<{ connection: BuddyConnection; onRate: () => void }>) {
  const c = connection;
  const route = c.from_city && c.to_city ? `${c.from_city} → ${c.to_city}` : null;
  return (
    <View style={styles.archiveCard}>
      <View style={[styles.archiveTag, styles.archiveTagBuddy]}>
        <Text style={styles.archiveTagText}>TRAVEL BUDDY</Text>
      </View>
      <Text style={styles.archiveRoute} numberOfLines={1}>
        {c.buddy?.name || "Travel buddy"}
      </Text>
      {route ? (
        <Text style={styles.archiveMeta} numberOfLines={1}>
          {route}
        </Text>
      ) : null}
      <View style={styles.archiveFooter}>
        <View style={styles.archivePersonCol} />
        {c.already_rated ? (
          <View style={styles.ratedBadge}>
            <Ionicons name="star" size={12} color={colors.safe} />
            <Text style={styles.ratedBadgeText}>Rated</Text>
          </View>
        ) : (
          <AppButton
            label="Rate buddy"
            onPress={onRate}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.archiveRateBtn}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Archive — completed delivery card
  archiveCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  archiveTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    marginBottom: 10,
  },
  archiveTagText: {
    color: colors.safe,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  archiveRoute: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  archiveMeta: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 4 },
  archiveFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  archivePersonCol: { flex: 1, minWidth: 0 },
  archiveRole: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  archivePersonName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 2 },
  archiveRateBtn: { minWidth: 130 },
  ratedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
  },
  ratedChipText: { color: colors.safe, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  archiveTagBuddy: { backgroundColor: colors.surfaceTintPrimary },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  ratedBadgeText: { color: colors.safe, fontSize: 13, lineHeight: 18, fontWeight: "800" },
});
