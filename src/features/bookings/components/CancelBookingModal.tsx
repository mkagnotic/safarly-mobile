import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { ActivityIndicator, Modal, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { FormBanner } from "@/components/ui/FormBanner";
import { colors } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import { KeyboardModalCard } from "@/features/bookings/components/KeyboardModalCard";

// ─────────────── Cancel modal ───────────────

interface CancelBookingModalProps {
  open: boolean;
  pending: boolean;
  /** What happens to the money (and the parcel) if they go ahead. */
  moneyLine?: string;
  /** Why the last attempt failed — shown inline; the modal stays open to retry. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

export function CancelBookingModal({
  open,
  pending,
  moneyLine,
  error,
  onCancel,
  onConfirm,
}: Readonly<CancelBookingModalProps>) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleClose = () => {
    if (pending) return;
    setReason("");
    onCancel();
  };

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardModalCard onBackdropPress={handleClose}>
        <View style={sharedStyles.modalHeader}>
          <Text style={sharedStyles.modalTitle}>Cancel this booking?</Text>
          <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <Text style={sharedStyles.modalBody}>
          Tell the other party why you're cancelling. This is shared with them.
        </Text>
        {moneyLine ? <Text style={sharedStyles.modalBody}>{moneyLine}</Text> : null}
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder="Reason for cancellation..."
          placeholderTextColor={colors.mutedText}
          style={sharedStyles.modalInput}
          maxLength={1000}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!pending}
          autoFocus
        />
        <FormBanner message={error} />
        <View style={sharedStyles.modalFooter}>
          <Pressable
            onPress={handleClose}
            disabled={pending}
            style={[sharedStyles.modalButton, sharedStyles.modalButtonSecondary]}
            accessibilityRole="button"
            accessibilityLabel="Keep booking"
          >
            <Text style={sharedStyles.modalButtonSecondaryText}>Keep booking</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={pending || !reason.trim()}
            style={[
              sharedStyles.modalButton,
              sharedStyles.modalButtonDanger,
              (pending || !reason.trim()) && sharedStyles.modalButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Cancel booking"
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={sharedStyles.modalButtonDangerText}>Cancel booking</Text>
            )}
          </Pressable>
        </View>
      </KeyboardModalCard>
    </Modal>
  );
}
