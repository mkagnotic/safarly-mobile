import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import type { Booking } from "@/services/api";
import { colors } from "@/theme/colors";
import { formatLocalDate } from "@/utils/travelDate";

/**
 * A delay only matters while the journey is still ahead: paid and not yet
 * delivered (web rule, bookings canon #17). The old "ended" list named statuses
 * a booking never has and missed delivered, so a delivered parcel still read "Your carrier reported a delay".
 */
export const DELAY_NOTICE_STATUSES: ReadonlySet<string> = new Set(["payment_secured", "in_transit"]);

/**
 * The carrier's delay, told to the SENDER. The carrier's card said "You
 * reported a delay"; the sender, whose parcel it is, was never told (money
 * canon #50). Date formatted, never the raw ISO string.
 */
export function SenderDelayNotice({ booking }: Readonly<{ booking: Booking }>) {
  if (!booking.delay_reason || !DELAY_NOTICE_STATUSES.has(booking.status)) return null;
  return (
    <View style={styles.notice} testID="sender-delay-notice">
      <Ionicons name="warning-outline" size={13} color={colors.warning} />
      <Text style={styles.text}>
        Your carrier reported a delay
        {booking.agreed_travel_date ? ` — now travelling ${formatLocalDate(booking.agreed_travel_date)}` : ""}.
        {booking.delay_note ? ` "${booking.delay_note}"` : ""}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.40)",
    backgroundColor: "rgba(245,159,10,0.08)",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 7,
  },
  text: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
});
