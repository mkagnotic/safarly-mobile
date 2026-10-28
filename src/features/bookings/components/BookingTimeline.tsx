import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import type { UseBookingDetailResult } from "@/hooks/api/useBookingDetail";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import { formatDateTime } from "@/features/bookings/lib/bookingDisplay";
import { bookingEventLabel, bookingStatusLabel } from "@/features/bookings/lib/bookingEventLabel";

/** The booking's event history, oldest first. */
export function BookingTimeline({
  timeline,
}: Readonly<{ timeline: NonNullable<UseBookingDetailResult["timeline"]> }>) {
  return (
    <View style={sharedStyles.expandedSection}>
      <Text style={sharedStyles.expandedLabel}>Timeline</Text>
      {timeline.map((e, idx) => (
        <View key={`${e.event}-${e.created_at}-${idx}`} style={styles.timelineRow}>
          <View style={styles.timelineDot} />
          <View style={{ flex: 1 }}>
            <Text style={styles.timelineEvent}>
              <Text style={styles.timelineEventName}>{bookingEventLabel(e.event)}</Text>
              {e.description ? (
                <Text style={styles.timelineEventDesc}> - {e.description}</Text>
              ) : null}
            </Text>
            <Text style={styles.timelineDate}>{formatDateTime(e.created_at)}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  // Timeline
  timelineRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  timelineEvent: { color: colors.text, fontSize: 12, lineHeight: 16 },
  timelineEventName: { color: colors.text, fontWeight: "700" },
  timelineEventDesc: { color: colors.mutedText },
  timelineDate: { color: colors.subtleText, fontSize: 11, marginTop: 2 },
});
