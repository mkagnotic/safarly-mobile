import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";

/** Carrier-side notice: you hold the parcel, the sender has not paid yet. */
export function AwaitingPaymentNotice() {
  return (
    <View style={styles.awaitingPayCard}>
      <View style={styles.awaitingPayHeader}>
        <Ionicons name="time-outline" size={14} color={colors.warning} />
        <Text style={styles.awaitingPayLabel}>AWAITING PAYMENT</Text>
      </View>
      <Text style={styles.awaitingPayTitle}>You have the parcel - keep hold of it</Text>
      <Text style={styles.awaitingPayBody}>
        Your sender has 48 hours to pay and secure the delivery. Please continue holding
        the parcel; we'll let you know as soon as the payment lands. Don't travel with it
        until then.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  awaitingPayCard: {
    borderWidth: 1,
    borderColor: "rgba(245,159,10,0.40)",
    backgroundColor: "rgba(245,159,10,0.06)",
    borderRadius: 14,
    padding: 12,
    gap: 4,
    width: "100%",
  },
  awaitingPayHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  awaitingPayLabel: { color: colors.warning, fontSize: 10, fontWeight: "800", letterSpacing: 0.6 },
  awaitingPayTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  awaitingPayBody: { color: colors.mutedText, fontSize: 11, lineHeight: 16, fontWeight: "500" },
});
