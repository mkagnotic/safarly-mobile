import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { LIBRARY_PICK_OPTIONS, requestLibraryPermission } from "@/lib/imagePicker";
import { useState } from "react";
import { ActivityIndicator, Image, Modal, StyleSheet, Text, TextInput, View } from "react-native";
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
  REJECT_REASON_MIN, minLengthHint,
} from "@/features/bookings/lib/modalValidation";
import { declineCopy } from "@/features/bookings/lib/moneyMessages";
import {
  ADD_PHOTOS_LABEL,
  addPhotos,
  HANDOFF_PHOTOS_MAX,
  PHOTO_LIMIT_MESSAGE,
  photoCounter,
  remainingPhotoSlots,
  removePhotoAt,
  UPLOADING_PHOTOS,
} from "@/features/bookings/lib/handoffPhotos";

// ─────────────── Reject handoff modal ───────────────

interface RejectHandoffModalProps {
  open: boolean;
  pending: boolean;
  /** Default for "do you have it?", derived from the handoff record. */
  parcelLikelyWithCarrier: boolean;
  /** The sender marked it sent. Before that this IS the carrier's cancel, not an
   *  inspection decline, and the dialog says so (web parity: HandoffActions). */
  parcelDispatched: boolean;
  /** The sender flagged it returnable to the seller - picks the follow-up line, as on web. */
  returnEligible?: boolean;
  /** Why the last attempt failed — shown inline; the modal stays open to retry. */
  error?: string | null;
  onCancel: () => void;
  /** `files`: up to 5 photos - uploaded one by one, then sent with the decline. */
  onConfirm: (reason: string, withCarrier: boolean, files: RNUploadFile[]) => void;
}

export function RejectHandoffModal({
  open,
  pending,
  parcelLikelyWithCarrier,
  parcelDispatched,
  returnEligible = false,
  error,
  onCancel,
  onConfirm,
}: Readonly<RejectHandoffModalProps>) {
  const [reason, setReason] = useState("");
  const [photos, setPhotos] = useState<RNUploadFile[]>([]);
  // An unusable pick used to be dropped silently, leaving the person thinking
  // their evidence was attached. Say why instead.
  const [photoError, setPhotoError] = useState<string | null>(null);
  // Declining does not answer "where is the parcel now?" - and getting that
  // wrong is how a real parcel ends up stranded at the carrier's address.
  const [withCarrier, setWithCarrier] = useState(parcelLikelyWithCarrier);

  const handleClose = () => {
    if (pending) return;
    setReason("");
    setPhotos([]);
    setPhotoError(null);
    onCancel();
  };

  const pickPhotos = async () => {
    const remaining = remainingPhotoSlots(photos.length);
    if (remaining <= 0) {
      setPhotoError(PHOTO_LIMIT_MESSAGE);
      return;
    }
    try {
      const perm = await requestLibraryPermission();
      if (perm.status !== "granted") return;
      const result = await ImagePicker.launchImageLibraryAsync({
        ...LIBRARY_PICK_OPTIONS,
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: true,
        selectionLimit: remaining,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked: RNUploadFile[] = [];
      let problem: string | null = null;
      result.assets.forEach((asset, i) => {
        const type = evidenceMimeType(asset.mimeType, asset.fileName);
        if (!EVIDENCE_TYPES.has(type)) {
          problem = "That photo format isn't supported. Choose a JPEG, PNG or WebP image.";
          return;
        }
        if (asset.fileSize && asset.fileSize > MAX_EVIDENCE_BYTES) {
          problem = "That photo is larger than 10 MB. Choose a smaller one.";
          return;
        }
        picked.push({
          uri: asset.uri,
          name: asset.fileName ?? `evidence-${Date.now()}-${i}.jpg`,
          type,
        });
      });
      // Functional update: a slow picker must not overwrite photos added meanwhile.
      // A picker that ignored selectionLimit is trimmed to 5 - and says so.
      setPhotos((prev) => addPhotos(prev, picked).photos);
      setPhotoError(problem ?? (picked.length > remaining ? PHOTO_LIMIT_MESSAGE : null));
    } catch {
      /* ignore pick failures */
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => removePhotoAt(prev, index));
    setPhotoError(null);
  };

  const trimmed = reason.trim();
  const reasonOk = trimmed.length >= REJECT_REASON_MIN;
  const copy = declineCopy(parcelDispatched);

  const handleConfirm = () => {
    if (!reasonOk) return;
    onConfirm(trimmed, withCarrier, photos);
  };

  return (
    <Modal statusBarTranslucent navigationBarTranslucent visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <KeyboardModalCard onBackdropPress={handleClose}>
        <View style={sharedStyles.modalHeader}>
          <View style={sharedStyles.modalHeaderBubbleDanger}>
            <Ionicons name="close-circle" size={18} color={colors.danger} />
          </View>
          <Text style={sharedStyles.modalTitle}>{copy.title}</Text>
          <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>
        <Text style={sharedStyles.modalBody}>
          {copy.body}{" "}
          {returnEligible
            ? "Because this is a returnable order, the receiver can send it back to the seller."
            : "The receiver then arranges collection of the parcel from you."}{" "}
          Tell us what's wrong so we can keep records.
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
        {minLengthHint(trimmed.length, REJECT_REASON_MIN) ? (
          <Text style={sharedStyles.modalHelper}>
            {minLengthHint(trimmed.length, REJECT_REASON_MIN)}
          </Text>
        ) : null}

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
            accessibilityLabel="The receiver has the parcel"
          >
            <Text style={styles.returnWhereTitle}>The receiver has it</Text>
            <Text style={styles.returnWhereHint}>I declined at the meetup — nothing to send back.</Text>
          </Pressable>
        </View>
        <Text style={sharedStyles.modalHelper}>
          {withCarrier
            ? "The receiver will be asked where to send it, and you'll confirm once it's on its way."
            : "Nothing to return — the booking closes as soon as you submit."}
        </Text>

        <View style={styles.photosHeader}>
          <Text style={[sharedStyles.modalFieldLabel, styles.photosLabel]}>{ADD_PHOTOS_LABEL}</Text>
          <Text style={styles.photosCounter} accessibilityLabel={`${photos.length} of ${HANDOFF_PHOTOS_MAX} photos added`}>
            {photoCounter(photos.length)}
          </Text>
        </View>
        {photos.length > 0 ? (
          <View style={styles.thumbGrid}>
            {photos.map((p, i) => (
              <View key={`${i}-${p.uri}`} style={styles.thumb}>
                <Image source={{ uri: p.uri }} style={styles.thumbImage} />
                <Pressable
                  onPress={() => removePhoto(i)}
                  disabled={pending}
                  style={styles.thumbRemove}
                  hitSlop={6}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove photo ${i + 1}`}
                >
                  <Ionicons name="close" size={14} color={colors.white} />
                </Pressable>
              </View>
            ))}
          </View>
        ) : null}
        <Pressable
          onPress={() => void pickPhotos()}
          disabled={pending}
          style={styles.photoPickerButton}
          accessibilityRole="button"
          accessibilityLabel={ADD_PHOTOS_LABEL}
        >
          <Ionicons name="camera-outline" size={16} color={colors.subtleText} />
          <Text style={styles.photoPickerText}>{ADD_PHOTOS_LABEL}</Text>
        </Pressable>
        {pending && photos.length > 0 ? (
          <Text style={sharedStyles.modalHelper} accessibilityLiveRegion="polite">
            {UPLOADING_PHOTOS}
          </Text>
        ) : null}

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
            accessibilityLabel="Decline parcel"
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={sharedStyles.modalButtonDangerText}>Decline parcel</Text>
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
  photosHeader: { flexDirection: "row", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 6 },
  photosLabel: { flexShrink: 1 },
  photosCounter: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  thumbGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumb: { width: 56, height: 56, borderRadius: 10, overflow: "hidden", backgroundColor: colors.surfaceMuted },
  thumbImage: { width: "100%", height: "100%" },
  thumbRemove: {
    position: "absolute",
    top: 2,
    right: 2,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "rgba(0,0,0,0.6)",
    alignItems: "center",
    justifyContent: "center",
  },
  photoPickerButton: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: colors.border,
    borderStyle: "dashed",
  },
  photoPickerText: { color: colors.subtleText, fontSize: 13, fontWeight: "700", flexShrink: 1, textAlign: "center" },
});
