import { StyleSheet, Text, View } from "react-native";

import { bookingFee } from "@/features/bookings/paymentMath";
import type { Booking } from "@/services/api";
import { colors } from "@/theme/colors";
import { formatMoney } from "@/utils/money";
import { formatLocalDate } from "@/utils/travelDate";
import { sharedStyles } from "@/features/bookings/bookingsStyles";

/** Category, fee and agreed travel date of the booked parcel. */
export function ParcelDetailsSection({ booking }: Readonly<{ booking: Booking }>) {
  if (!booking.parcel) return null;
  return (
    <View style={sharedStyles.expandedSection}>
      <Text style={sharedStyles.expandedLabel}>Parcel Details</Text>
      <View style={styles.parcelGrid}>
        <View style={styles.parcelCell}>
          <Text style={styles.parcelCellKey}>Category: </Text>
          <Text style={styles.parcelCellValue}>{booking.parcel.category}</Text>
        </View>
        <View style={styles.parcelCell}>
          <Text style={styles.parcelCellKey}>Fee: </Text>
          <Text style={[styles.parcelCellValue, { color: colors.primary }]}>
            {formatMoney(bookingFee(booking), booking.parcel.fee_currency)}
          </Text>
        </View>
        {booking.agreed_travel_date ? (
          <View style={styles.parcelCell}>
            <Text style={styles.parcelCellKey}>Travel date: </Text>
            <Text style={styles.parcelCellValue}>
              {formatLocalDate(booking.agreed_travel_date, {
                month: "short",
                day: "numeric",
                year: "numeric",
                locale: "en-US",
              })}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  parcelGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  parcelCell: { flex: 1, minWidth: 140, flexDirection: "row" },
  parcelCellKey: { color: colors.mutedText, fontSize: 13 },
  parcelCellValue: { color: colors.text, fontSize: 13, fontWeight: "700" },
});
