import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";

// ─────────────── Accept handoff confirmation ───────────────

interface AcceptHandoffModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * Confirms the point of no return. Accepting transfers POSSESSION: from here no
 * timeout and no cancel can end the deal (it opens a return instead), and the
 * sender is only asked to pay AFTERWARDS. Firing that straight off a single tap
 * gave the carrier no moment to check they really had the parcel in hand.
 */
export function AcceptHandoffModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: Readonly<AcceptHandoffModalProps>) {
  const handleClose = () => {
    if (pending) return;
    onCancel();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={sharedStyles.modalBackdrop} onPress={handleClose} />
      <View style={sharedStyles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={sharedStyles.modalHeader}>
            <Text style={sharedStyles.modalTitle}>Take responsibility for this parcel?</Text>
            <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={sharedStyles.modalBody}>
            Only accept once the parcel is physically with you and you&apos;ve checked it over.
          </Text>
          <Text style={styles.modalBullet}>
            <Text style={styles.modalBulletStrong}>The parcel becomes your responsibility</Text>{" "}
            from the moment you accept.
          </Text>
          <Text style={styles.modalBullet}>
            <Text style={styles.modalBulletStrong}>Your sender is asked to pay next</Text> — within
            48 hours, plus a 24-hour grace period. You are accepting before the money is collected.
          </Text>
          <Text style={styles.modalBullet}>
            <Text style={styles.modalBulletStrong}>The deal can no longer time out.</Text>{" "}
            If you end it after this, the parcel has to go back — and once your sender has paid, that
            costs you a cash penalty and a strike.
          </Text>
          <Text style={styles.modalBullet}>
            No code is needed now — the 6-digit code belongs to the final delivery step.
          </Text>
          <View style={sharedStyles.modalFooter}>
            <Pressable
              onPress={handleClose}
              disabled={pending}
              style={[sharedStyles.modalButton, sharedStyles.modalButtonSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Not yet"
            >
              <Text style={sharedStyles.modalButtonSecondaryText}>Not yet</Text>
            </Pressable>
            <Pressable
              onPress={onConfirm}
              disabled={pending}
              style={[sharedStyles.modalButton, styles.modalButtonPrimary, pending && sharedStyles.modalButtonDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Yes, I have it, accept the parcel"
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonPrimaryText}>Yes, I have it — accept</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 18,
    gap: 12,
  },
  modalButtonPrimary: { backgroundColor: colors.primary },
  modalButtonPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  modalBullet: { color: colors.mutedText, fontSize: 13, lineHeight: 19, marginTop: 8 },
  modalBulletStrong: { color: colors.text, fontWeight: "800" },
});
