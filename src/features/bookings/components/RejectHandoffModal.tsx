import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LIBRARY_PICK_OPTIONS, requestLibraryPermission } from "@/lib/imagePicker";
import { useState } from "react";
import { ActivityIndicator, Modal, StyleSheet, Text, TextInput, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { FormBanner } from "@/components/ui/FormBanner";
import type { RNUploadFile } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import { KeyboardModalCard } from "@/features/bookings/components/KeyboardModalCard";
import {
  EVIDENCE_TYPES,
  evidenceMimeType,
  MAX_EVIDENCE_BYTES,
  REJECT_REASON_MIN,
} from "@/features/bookings/lib/modalValidation";

// ─────────────── Reject handoff modal ───────────────

interface RejectHandoffModalProps {
  open: boolean;
  pending: boolean;
  /** Default for "do you have it?", derived from the handoff record. */
  parcelLikelyWithCarrier: boolean;
  /** Why the last attempt failed — shown inline; the modal stays open to retry. */
  error?: string | null;
  onCancel: () => void;
  onConfirm: (reason: string, withCarrier: boolean, file?: RNUploadFile) => void;
}

export function RejectHandoffModal({
  open,
  pending,
  parcelLikelyWithCarrier,
  error,
  onCancel,
  onConfirm,
}: Readonly<RejectHandoffModalProps>) {
  const [reason, setReason] = useState("");
  const [photo, setPhoto] = useState<RNUploadFile | null>(null);
  // An unusable pick used to be dropped silently, leaving the person thinking
  // their evidence was attached. Say why instead.
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Declining does not answer "where is the parcel now?" - and getting that
  // wrong is how a real parcel ends up stranded at the carrier's address.
  const [withCarrier, setWithCarrier] = useState(parcelLikelyWithCarrier);

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setPhoto(null);
    setPhotoError(null);
    onCancel();
  };

  const pickPhoto = async () => {
    try {
      const perm = await requestLibraryPermission();
      if (perm.status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({ ...LIBRARY_PICK_OPTIONS, mediaTypes: ["images"], quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const type = evidenceMimeType(asset.mimeType, asset.fileName);
      if (!EVIDENCE_TYPES.has(type)) {
        setPhotoError("That photo format isn't supported. Choose a JPEG, PNG or WebP image.");
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_EVIDENCE_BYTES) {
        setPhotoError("That photo is larger than 10 MB. Choose a smaller one.");
        return;
      }
      setPhotoError(null);
      setPhoto({
        uri: asset.uri,
        name: asset.fileName ?? `evidence-${Date.now()}.jpg`,
        type,
      });
    } catch {
      /* ignore pick failures */
    }
  };

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= REJECT_REASON_MIN;

  const handleConfirm = () => {
    if (!reasonOk) return;
    onConfirm(trimmed, withCarrier, photo ?? undefined);
  };

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardModalCard onBackdropPress={handleClose}>
        <View style={sharedStyles.modalHeader}>
          <View style={sharedStyles.modalHeaderBubbleDanger}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </View>
          <Text style={sharedStyles.modalTitle}>Decline this parcel?</Text>
          <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <Text style={sharedStyles.modalBody}>
          Use this when the parcel has reached you but you can't carry it — unsafe,
          oversized, or not what the listing described. The sender gets a full refund
          with no penalty to you, and the parcel re-opens for other carriers. Tell us
          what's wrong so we can keep records.
        </Text>
        <TextInput
          value={reason}
          onChangeText={setReason}
          placeholder={`Reason (min ${REJECT_REASON_MIN} characters)…`}
          placeholderTextColor={colors.mutedText}
          style={sharedStyles.modalInput}
          maxLength={1000}
          multiline
          numberOfLines={3}
          textAlignVertical="top"
          editable={!pending}
          autoFocus
        />
        <Text style={sharedStyles.modalHelper}>
          {trimmed.length}/{REJECT_REASON_MIN} characters minimum
        </Text>

        <Text style={sharedStyles.modalFieldLabel}>Where is the parcel now?</Text>
        <View style={styles.returnWhereRow}>
          <Pressable
            onPress={() => setWithCarrier(true)}
            style={[styles.returnWhereOption, withCarrier && styles.returnWhereOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: withCarrier }}
            accessibilityLabel="I have the parcel"
          >
            <Text style={styles.returnWhereTitle}>I have it</Text>
            <Text style={styles.returnWhereHint}>It reached me and has to go back.</Text>
          </Pressable>
          <Pressable
            onPress={() => setWithCarrier(false)}
            style={[styles.returnWhereOption, !withCarrier && styles.returnWhereOptionActive]}
            accessibilityRole="radio"
            accessibilityState={{ selected: !withCarrier }}
            accessibilityLabel="The sender has the parcel"
          >
            <Text style={styles.returnWhereTitle}>The sender has it</Text>
            <Text style={styles.returnWhereHint}>Declined at the meetup - nothing to send back.</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.modalHelper}>
          {withCarrier
            ? "The sender will be asked where to send it, and you'll confirm once it's on its way."
            : "Nothing to return - the booking closes as soon as you submit."}
        </Text>

        <Pressable
          onPress={() => void pickPhoto()}
          disabled={pending}
          style={[styles.photoPickerButton, photo && styles.photoPickerButtonSelected]}
          accessibilityRole="button"
          accessibilityLabel={photo ? "Photo selected" : "Add photo evidence"}
        >
          <Ionicons
            name={photo ? "checkmark-circle" : "camera-outline"}
            size={16}
            color={photo ? colors.safe : colors.subtleText}
          />
          <Text style={[styles.photoPickerText, photo && styles.photoPickerTextSelected]} numberOfLines={1}>
            {photo ? photo.name : "Add photo evidence (optional)"}
          </Text>
        </Pressable>

        <FormBanner message={photoError ?? error} />

        <View style={sharedStyles.modalFooter}>
          <Pressable
            onPress={handleClose}
            disabled={pending}
            style={[sharedStyles.modalButton, sharedStyles.modalButtonSecondary]}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <Text style={sharedStyles.modalButtonSecondaryText}>Go back</Text>
          </Pressable>
          <Pressable
            onPress={handleConfirm}
            disabled={pending || !reasonOk}
            style={[
              sharedStyles.modalButton,
              sharedStyles.modalButtonDanger,
              (pending || !reasonOk) && sharedStyles.modalButtonDisabled,
            ]}
            accessibilityRole="button"
            accessibilityLabel="Decline and refund the sender"
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={sharedStyles.modalButtonDangerText}>Decline and refund</Text>
            )}
          </Pressable>
        </View>
      </KeyboardModalCard>
    </Modal>
  );
}

const styles = StyleSheet.create({
  returnWhereRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  returnWhereOption: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.card,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    gap: 2,
  },
  returnWhereOptionActive: { borderColor: colors.primary, backgroundColor: primaryTint.fill12 },
  returnWhereTitle: { color: colors.text, fontSize: 12, fontWeight: "800" },
  returnWhereHint: { color: colors.mutedText, fontSize: 10, lineHeight: 14, fontWeight: "500" },
  photoPickerButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoPickerButtonSelected: {
    backgroundColor: "rgba(34,195,93,0.08)",
    borderColor: "rgba(34,195,93,0.40)",
    borderStyle: "solid",
  },
  photoPickerText: { color: colors.subtleText, fontSize: 13, fontWeight: "700" },
  photoPickerTextSelected: { color: colors.safe },
});
