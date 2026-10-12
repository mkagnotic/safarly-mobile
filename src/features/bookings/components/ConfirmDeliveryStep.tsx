import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";

import { journeyStepShort, currentJourneyStep } from "@/utils/journeySteps";
import type { Booking } from "@/services/api";
import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import type { ExpandedBookingState } from "@/features/bookings/hooks/useExpandedBooking";
import type { BookingActions } from "@/features/bookings/lib/bookingActions";

interface ConfirmDeliveryStepProps {
  booking: Booking;
  otpCode: string;
  setOtpCode: ExpandedBookingState["setOtpCode"];
  handleConfirmOtp: BookingActions["handleConfirmOtp"];
  actionPending: ExpandedBookingState["actionPending"];
}

/** Phase 3 (delivery) card for the carrier: enter the receiver's code. */
export function ConfirmDeliveryStep({
  booking,
  otpCode,
  setOtpCode,
  handleConfirmOtp,
  actionPending,
}: Readonly<ConfirmDeliveryStepProps>) {
  return (
    <View style={styles.stepCardSafe}>
      <View style={sharedStyles.stepCardHeader}>
        <Ionicons name="key-outline" size={14} color={colors.safe} />
        <Text style={sharedStyles.stepCardEyebrowSafe}>{journeyStepShort(currentJourneyStep(booking))}</Text>
      </View>
      <Text style={sharedStyles.stepCardTitle}>Parcel is ready to be delivered</Text>
      <Text style={sharedStyles.stepCardBody}>
        Chat with your receiver and agree on the meetup point or the address in
        chat. Once you deliver to the person, request the 6-digit code from your
        receiver. Entering it completes the delivery and releases your payout from
        escrow.
      </Text>
      <Text style={styles.stepCardFieldLabel}>Delivery code from the receiver</Text>
      <View style={styles.otpRow}>
        <TextInput
          value={otpCode}
          onChangeText={(v) => setOtpCode(v.replace(/[^0-9]/g, ""))}
          placeholder="6-digit code"
          placeholderTextColor={colors.mutedText}
          style={styles.otpInput}
          keyboardType="number-pad"
          maxLength={6}
          accessibilityLabel="Delivery code from the receiver"
        />
        <Pressable
          onPress={handleConfirmOtp}
          disabled={actionPending !== null || otpCode.trim().length !== 6}
          style={[
            styles.otpConfirmButton,
            (actionPending !== null || otpCode.trim().length !== 6) && styles.actionDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Confirm delivery"
        >
          {actionPending === "confirm-otp" ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={14} color={colors.white} />
              <Text style={styles.otpConfirmText}>Confirm delivery</Text>
            </>
          )}
        </Pressable>
      </View>
      <Text style={sharedStyles.stepCardFootnote}>
        Not at the destination yet? Nothing to do — come back to this booking when
        you hand the parcel over.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  actionDisabled: { opacity: 0.5 },
  stepCardSafe: {
    width: "100%",
    backgroundColor: "rgba(34,195,93,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,195,93,0.30)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 6,
  },
  stepCardFieldLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
    marginTop: 4,
  },

  // OTP entry
  otpRow: { flexDirection: "row", gap: 8, width: "100%" },
  otpInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: "Courier",
  },
  otpConfirmButton: {
    backgroundColor: colors.safe,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  otpConfirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
