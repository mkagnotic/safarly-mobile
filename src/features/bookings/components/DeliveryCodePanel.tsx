import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";

import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import type { ExpandedBookingState } from "@/features/bookings/hooks/useExpandedBooking";
import type { BookingActions } from "@/features/bookings/lib/bookingActions";

interface DeliveryCodePanelProps {
  generatedOtp: string | null;
  otpEmailed: boolean;
  handleCopyOtp: BookingActions["handleCopyOtp"];
  handleGenerateOtp: BookingActions["handleGenerateOtp"];
  actionPending: ExpandedBookingState["actionPending"];
}

/** The sender's delivery code once generated, or the button that generates it. */
export function DeliveryCodePanel({
  generatedOtp,
  otpEmailed,
  handleCopyOtp,
  handleGenerateOtp,
  actionPending,
}: Readonly<DeliveryCodePanelProps>) {
  return generatedOtp ? (
    <View style={styles.otpDisplayCard}>
      <View style={styles.otpDisplayHeader}>
        <Ionicons name="key" size={14} color={colors.safe} />
        <Text style={styles.otpDisplayHeaderText}>Your delivery code</Text>
      </View>
      <Text style={styles.otpDisplayCode} accessibilityLabel="Delivery code">
        {generatedOtp}
      </Text>
      <Text style={styles.otpDisplayHint}>
        Give this to the person receiving the parcel at the destination — they
        read it out to the carrier at drop-off. It expires in 30 min; resend if
        it lapses.
      </Text>
      {otpEmailed ? (
        <Text style={styles.otpEmailedNote}>We&apos;ve also emailed this code to you.</Text>
      ) : null}
      <View style={styles.otpDisplayActions}>
        <Pressable
          onPress={handleCopyOtp}
          style={[sharedStyles.actionButton, styles.actionSafe, styles.otpDisplayBtn]}
          accessibilityRole="button"
          accessibilityLabel="Copy delivery code"
        >
          <Ionicons name="copy-outline" size={14} color={colors.safe} />
          <Text style={styles.actionSafeText}>Copy code</Text>
        </Pressable>
        <Pressable
          onPress={handleGenerateOtp}
          disabled={actionPending !== null}
          style={[sharedStyles.actionButton, styles.actionGhost, styles.otpDisplayBtn]}
          accessibilityRole="button"
          accessibilityLabel="Generate a new code"
        >
          {actionPending === "generate-otp" ? (
            <ActivityIndicator size="small" color={colors.text} />
          ) : (
            <>
              <Ionicons name="refresh-outline" size={14} color={colors.text} />
              <Text style={styles.actionGhostText}>Resend</Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  ) : (
    <Pressable
      style={[sharedStyles.actionButton, styles.actionSafe]}
      onPress={handleGenerateOtp}
      disabled={actionPending !== null}
      accessibilityRole="button"
      accessibilityLabel="Generate Delivery Code"
    >
      {actionPending === "generate-otp" ? (
        <ActivityIndicator size="small" color={colors.safe} />
      ) : (
        <>
          <Ionicons name="key-outline" size={14} color={colors.safe} />
          <Text style={styles.actionSafeText}>Generate Delivery Code</Text>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  actionSafe: { backgroundColor: "rgba(34,195,93,0.12)" },
  actionSafeText: { color: colors.safe, fontSize: 13, fontWeight: "800" },
  actionGhost: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: 1,
    borderColor: colors.border,
  },
  actionGhostText: { color: colors.text, fontSize: 13, fontWeight: "800" },

  // OTP display card — sacred per the implementation guide: the plaintext
  // code is returned by the server exactly once, so we surface it big and
  // copyable until the screen unmounts.
  otpDisplayCard: {
    backgroundColor: "rgba(34,195,93,0.08)",
    borderWidth: 1,
    borderColor: "rgba(34,195,93,0.30)",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    gap: 8,
    width: "100%",
  },
  otpDisplayHeader: { flexDirection: "row", alignItems: "center", gap: 6 },
  otpDisplayHeaderText: {
    color: colors.safe,
    fontSize: 12,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  otpDisplayCode: {
    color: colors.text,
    fontSize: 32,
    fontWeight: "800",
    letterSpacing: 8,
    fontFamily: "Courier",
    textAlign: "center",
    paddingVertical: 6,
  },
  otpEmailedNote: { color: colors.safe, fontSize: 12, fontWeight: "700", marginTop: 6 },
  otpDisplayHint: {
    color: colors.mutedText,
    fontSize: 12,
    lineHeight: 16,
    fontWeight: "500",
  },
  otpDisplayActions: { flexDirection: "row", gap: 8, marginTop: 4 },
  otpDisplayBtn: { flex: 1 },
});
