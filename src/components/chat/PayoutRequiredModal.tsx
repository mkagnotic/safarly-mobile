import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

interface PayoutRequiredModalProps {
  open: boolean;
  onClose: () => void;
  /** Called when the user taps "Set up payouts" — parent navigates to PayoutSetupTab. */
  onSetup: () => void;
}

/**
 * Shown when the signed-in CARRIER tries to accept a delivery but hasn't
 * finished Stripe payout onboarding. The backend blocks the accept
 * (`CARRIER_PAYOUT_NOT_READY`) — this turns that dead-end into an actionable
 * next step instead of a bare error. Mirrors web's `PayoutRequiredDialog`.
 *
 * Only for the user who has to act (the carrier). When it's the OTHER party who
 * isn't set up, the caller shows an info banner instead — there's nothing this
 * user can fix.
 */
export function PayoutRequiredModal({ open, onClose, onSetup }: Readonly<PayoutRequiredModalProps>) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityRole="button" accessibilityLabel="Dismiss" />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.iconBubble}>
            <Ionicons name="business" size={22} color={colors.primary} />
          </View>
          <Text style={styles.title}>Set up payouts to accept this delivery</Text>
          <Text style={styles.body}>
            Before you can carry a parcel, you need a payout account so your earnings can reach your
            bank. It only takes a minute, and you can come straight back to accept.
          </Text>

          <View style={styles.reasons}>
            <Reason icon="shield-checkmark-outline" text="Handled securely by Stripe — Safarly never stores your bank details." />
            <Reason icon="cash-outline" text="Free to connect. Payment is held in escrow and released once delivery is confirmed." />
          </View>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.laterButton]}
              accessibilityRole="button"
              accessibilityLabel="Later"
            >
              <Text style={styles.laterText}>Later</Text>
            </Pressable>
            <Pressable
              onPress={onSetup}
              style={[styles.button, styles.setupButton]}
              accessibilityRole="button"
              accessibilityLabel="Set up payouts"
            >
              <Text style={styles.setupText}>Set up payouts</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function Reason({ icon, text }: Readonly<{ icon: keyof typeof Ionicons.glyphMap; text: string }>) {
  return (
    <View style={styles.reasonRow}>
      <View style={styles.reasonIcon}>
        <Ionicons name={icon} size={15} color={colors.mutedText} />
      </View>
      <Text style={styles.reasonText}>{text}</Text>
    </View>
  );
}

export default PayoutRequiredModal;

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: { width: "100%", maxWidth: 420, borderRadius: 18, backgroundColor: colors.card, padding: 20, gap: 12 },
  iconBubble: {
    width: 48,
    height: 48,
    borderRadius: 16,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
  body: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },
  reasons: { gap: 10, marginTop: 2 },
  reasonRow: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  reasonIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  reasonText: { flex: 1, color: colors.mutedText, fontSize: 12, lineHeight: 17 },
  footer: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 6 },
  button: { paddingHorizontal: 16, paddingVertical: 11, borderRadius: 12, alignItems: "center", justifyContent: "center", minWidth: 96 },
  laterButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  laterText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  setupButton: { backgroundColor: colors.primary },
  setupText: { color: colors.white, fontSize: 13, fontWeight: "800" },
});
