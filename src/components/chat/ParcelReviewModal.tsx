import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";
import {
  ActivityIndicator,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import {
  getErrorMessage,
  type ParcelReviewPhoto,
  type ParcelReviewReason,
  type ParcelReviewState,
  type RNUploadFile,
} from "@/services/api";
import { colors } from "@/theme/colors";

import type { ParcelReviewPending } from "@/hooks/api/useParcelReview";

/** 10 MB per file — matches the backend cap. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

const isPdfUrl = (u: string | null): boolean => !!u && /\.pdf(\?|$)/i.test(u);
const isPdfType = (t: string): boolean => t === "application/pdf";

/** Web parity (`ChatParcelReviewPrompt.tsx:23-30`). */
const REASONS: { value: ParcelReviewReason; label: string }[] = [
  { value: "too_large", label: "Too large" },
  { value: "restricted", label: "Restricted item" },
  { value: "fragile", label: "Fragile" },
  { value: "different_than_described", label: "Different than described" },
  { value: "airline_restriction", label: "Airline restriction" },
  { value: "other", label: "Other" },
];
const reasonLabel = (r: string | null): string =>
  REASONS.find((x) => x.value === r)?.label ?? r ?? "—";

interface ParcelReviewModalProps {
  open: boolean;
  review: ParcelReviewState | null;
  loading: boolean;
  pending: ParcelReviewPending;
  onClose: () => void;
  onUpload: (files: RNUploadFile[]) => void;
  onApprove: () => void;
  onReject: (reason: ParcelReviewReason, note?: string) => void;
  onCancelRequest: () => void;
}

/**
 * Parcel-photo review, in-chat. Mobile counterpart of web's
 * `ChatParcelReviewPrompt`, opened from the workflow pin's "Upload" / "Review"
 * CTA. Mirror of [[TravelDocModal]] with the uploader/reviewer roles swapped:
 * the SENDER adds at least 2 parcel photos (image or PDF), the CARRIER approves
 * or requests changes with a reason. Approval (with the travel doc) unlocks
 * payment — enforced server-side.
 */
export function ParcelReviewModal({
  open,
  review,
  loading,
  pending,
  onClose,
  onUpload,
  onApprove,
  onReject,
  onCancelRequest,
}: Readonly<ParcelReviewModalProps>) {
  const [files, setFiles] = useState<RNUploadFile[]>([]);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState<ParcelReviewReason>("too_large");
  const [note, setNote] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  useEffect(() => {
    if (!open) {
      setFiles([]);
      setRejecting(false);
      setReason("too_large");
      setNote("");
      setConfirmCancel(false);
    }
  }, [open]);

  // A status change (e.g. after a successful upload) drops the staged files so
  // the "under review" view doesn't still show a picker list.
  useEffect(() => {
    setFiles([]);
  }, [review?.status]);

  const maxPhotos = review?.max_photos ?? 8;
  const minPhotos = review?.min_photos ?? 2;
  const busy = pending !== null;

  const addFiles = (incoming: RNUploadFile[]) => {
    setFiles((prev) => [...prev, ...incoming].slice(0, maxPhotos));
  };

  const pickImages = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow photo access to add parcel photos.",
          variant: "warning",
        });
        return;
      }
      const remaining = Math.max(1, maxPhotos - files.length);
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsMultipleSelection: true,
        selectionLimit: remaining,
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked: RNUploadFile[] = [];
      for (const asset of result.assets) {
        if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
          showToast({ title: "Too large", message: "Each file must be under 10 MB.", variant: "error" });
          continue;
        }
        picked.push({
          uri: asset.uri,
          name: asset.fileName ?? `parcel-${Date.now()}-${picked.length}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        });
      }
      if (picked.length) addFiles(picked);
    } catch (err) {
      showToast({ title: "Couldn't pick photos", message: getErrorMessage(err), variant: "error" });
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow camera access to take a photo.",
          variant: "warning",
        });
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Each file must be under 10 MB.", variant: "error" });
        return;
      }
      addFiles([
        {
          uri: asset.uri,
          name: asset.fileName ?? `parcel-${Date.now()}.jpg`,
          type: asset.mimeType ?? "image/jpeg",
        },
      ]);
    } catch (err) {
      showToast({ title: "Couldn't take photo", message: getErrorMessage(err), variant: "error" });
    }
  };

  const pickPdfs = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: true,
      });
      if (result.canceled || !result.assets?.length) return;
      const picked: RNUploadFile[] = [];
      for (const asset of result.assets) {
        if (asset.size && asset.size > MAX_FILE_BYTES) {
          showToast({ title: "Too large", message: "Each file must be under 10 MB.", variant: "error" });
          continue;
        }
        picked.push({ uri: asset.uri, name: asset.name, type: asset.mimeType ?? "application/pdf" });
      }
      if (picked.length) addFiles(picked);
    } catch (err) {
      showToast({ title: "Couldn't pick files", message: getErrorMessage(err), variant: "error" });
    }
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!busy) onClose();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!busy) onClose();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="cube" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Parcel review</Text>
            <Text style={styles.subtitle}>Confirm the parcel before payment.</Text>
          </View>
          <Pressable
            onPress={() => {
              if (!busy) onClose();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          {loading && !review ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !review ? (
            <Text style={styles.infoBody}>
              Parcel review isn&apos;t available for this conversation yet.
            </Text>
          ) : review.viewer_role === "carrier" ? (
            <CarrierView
              review={review}
              pending={pending}
              busy={busy}
              rejecting={rejecting}
              reason={reason}
              note={note}
              setRejecting={setRejecting}
              setReason={setReason}
              setNote={setNote}
              onApprove={onApprove}
              onReject={() => onReject(reason, note.trim() || undefined)}
            />
          ) : (
            <SenderView
              review={review}
              pending={pending}
              busy={busy}
              files={files}
              minPhotos={minPhotos}
              maxPhotos={maxPhotos}
              confirmCancel={confirmCancel}
              setConfirmCancel={setConfirmCancel}
              pickImages={pickImages}
              takePhoto={takePhoto}
              pickPdfs={pickPdfs}
              removeFile={removeFile}
              onUpload={() => files.length >= minPhotos && onUpload(files)}
              onCancelRequest={onCancelRequest}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

// ───────────────────────── Carrier (reviewer) ─────────────────────────

function CarrierView({
  review,
  pending,
  busy,
  rejecting,
  reason,
  note,
  setRejecting,
  setReason,
  setNote,
  onApprove,
  onReject,
}: Readonly<{
  review: ParcelReviewState;
  pending: ParcelReviewPending;
  busy: boolean;
  rejecting: boolean;
  reason: ParcelReviewReason;
  note: string;
  setRejecting: (v: boolean) => void;
  setReason: (v: ParcelReviewReason) => void;
  setNote: (v: string) => void;
  onApprove: () => void;
  onReject: () => void;
}>) {
  if (review.status === "none" || review.status === "rejected") {
    return (
      <InfoBlock
        icon="time-outline"
        tone="muted"
        title={
          review.status === "rejected"
            ? "Waiting for the sender to update the parcel"
            : "Awaiting the sender's parcel photos"
        }
        body="The sender needs to add photos of the parcel before you can approve it."
      />
    );
  }

  // status === "pending" → carrier reviews the photos
  return (
    <View style={styles.stack}>
      <InfoBlock
        icon="shield-checkmark"
        tone="primary"
        title="The sender shared photos of the parcel."
        body="Review them, then accept or request changes."
      />
      <PhotoStrip photos={review.photos} />

      {rejecting ? (
        <View style={styles.stack}>
          <Text style={styles.fieldLabel}>Reason</Text>
          <View style={styles.reasonWrap}>
            {REASONS.map((r) => {
              const selected = r.value === reason;
              return (
                <Pressable
                  key={r.value}
                  onPress={() => setReason(r.value)}
                  disabled={busy}
                  style={[styles.reasonChip, selected && styles.reasonChipSelected]}
                  accessibilityRole="button"
                  accessibilityState={{ selected }}
                >
                  <Text style={[styles.reasonChipText, selected && styles.reasonChipTextSelected]}>
                    {r.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <TextInput
            value={note}
            onChangeText={setNote}
            multiline
            maxLength={500}
            placeholder="Add a note for the sender (optional)"
            placeholderTextColor={colors.subtleText}
            style={styles.noteInput}
          />
          <View style={styles.row}>
            <Pressable
              onPress={onReject}
              disabled={busy}
              style={[styles.btn, styles.btnWarning, styles.flex, busy && styles.btnDisabled]}
              accessibilityRole="button"
            >
              {pending === "reject" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnWarningText}>Request changes</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setRejecting(false);
                setNote("");
              }}
              disabled={busy}
              style={[styles.btn, styles.btnMuted]}
              accessibilityRole="button"
            >
              <Text style={styles.btnMutedText}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      ) : (
        <View style={styles.row}>
          <Pressable
            onPress={onApprove}
            disabled={busy}
            style={[styles.btn, styles.btnPrimary, styles.flex, busy && styles.btnDisabled]}
            accessibilityRole="button"
          >
            {pending === "approve" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Accept</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setRejecting(true)}
            disabled={busy}
            style={[styles.btn, styles.btnOutlineWarning, styles.flex]}
            accessibilityRole="button"
          >
            <Text style={styles.btnOutlineWarningText}>Reject</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Sender (uploader) ─────────────────────────

function SenderView({
  review,
  pending,
  busy,
  files,
  minPhotos,
  maxPhotos,
  confirmCancel,
  setConfirmCancel,
  pickImages,
  takePhoto,
  pickPdfs,
  removeFile,
  onUpload,
  onCancelRequest,
}: Readonly<{
  review: ParcelReviewState;
  pending: ParcelReviewPending;
  busy: boolean;
  files: RNUploadFile[];
  minPhotos: number;
  maxPhotos: number;
  confirmCancel: boolean;
  setConfirmCancel: (v: boolean) => void;
  pickImages: () => void;
  takePhoto: () => void;
  pickPdfs: () => void;
  removeFile: (i: number) => void;
  onUpload: () => void;
  onCancelRequest: () => void;
}>) {
  if (review.status === "pending") {
    return (
      <View style={styles.stack}>
        <InfoBlock
          icon="time-outline"
          tone="muted"
          title="Parcel under review"
          body="The carrier is reviewing your parcel photos. You'll be notified once it's approved."
        />
        <PhotoStrip photos={review.photos} />
      </View>
    );
  }

  // none | rejected → upload / re-upload
  const rejected = review.status === "rejected";
  const canAddMore = files.length < maxPhotos;
  return (
    <View style={styles.stack}>
      <InfoBlock
        icon={rejected ? "alert-circle" : "cube-outline"}
        tone={rejected ? "warning" : "primary"}
        title={rejected ? "The carrier asked you to update the parcel." : "Add photos of your parcel"}
        body={
          rejected
            ? `Reason: ${reasonLabel(review.reason)}${review.reason_note ? ` — ${review.reason_note}` : ""}`
            : `Add at least ${minPhotos} photos (an invoice or order screenshot is optional) so the carrier can approve carrying it.`
        }
      />

      {files.length > 0 ? (
        <View style={styles.fileList}>
          {files.map((f, i) => (
            <View key={`${f.name}-${i}`} style={styles.fileRow}>
              {isPdfType(f.type) ? (
                <View style={styles.fileThumbDoc}>
                  <Ionicons name="document-text-outline" size={18} color={colors.primary} />
                </View>
              ) : (
                <Image source={{ uri: f.uri }} style={styles.fileThumb} />
              )}
              <Text style={styles.fileName} numberOfLines={1}>
                {f.name}
              </Text>
              <Pressable
                onPress={() => removeFile(i)}
                hitSlop={6}
                disabled={busy}
                accessibilityRole="button"
                accessibilityLabel="Remove file"
              >
                <Ionicons name="close-circle" size={22} color={colors.mutedText} />
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      {canAddMore ? (
        <View style={styles.pickerRow}>
          <PickerChip icon="images" label="Photos" onPress={pickImages} disabled={busy} />
          <PickerChip icon="camera" label="Camera" onPress={takePhoto} disabled={busy} />
          <PickerChip icon="document-text" label="PDF" onPress={pickPdfs} disabled={busy} />
        </View>
      ) : null}

      <Text style={styles.attemptsText}>
        {files.length}/{maxPhotos} selected · minimum {minPhotos}
      </Text>

      <Pressable
        onPress={onUpload}
        disabled={files.length < minPhotos || busy}
        style={[styles.btn, styles.btnPrimary, (files.length < minPhotos || busy) && styles.btnDisabled]}
        accessibilityRole="button"
      >
        {pending === "upload" ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.btnPrimaryText}>Submit for review</Text>
        )}
      </Pressable>

      {rejected ? (
        confirmCancel ? (
          <View style={styles.row}>
            <Pressable
              onPress={onCancelRequest}
              disabled={busy}
              style={[styles.btn, styles.btnDanger, styles.flex, busy && styles.btnDisabled]}
              accessibilityRole="button"
            >
              {pending === "cancel" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnDangerText}>Yes, cancel request</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => setConfirmCancel(false)}
              disabled={busy}
              style={[styles.btn, styles.btnMuted]}
              accessibilityRole="button"
            >
              <Text style={styles.btnMutedText}>Keep</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => setConfirmCancel(true)}
            disabled={busy}
            style={[styles.btn, styles.btnOutlineDanger]}
            accessibilityRole="button"
          >
            <Text style={styles.btnOutlineDangerText}>Cancel request</Text>
          </Pressable>
        )
      ) : null}
    </View>
  );
}

// ───────────────────────── Small pieces ─────────────────────────

function PhotoStrip({ photos }: Readonly<{ photos: ParcelReviewPhoto[] }>) {
  if (!photos.length) return null;
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.photoStrip}
    >
      {photos.map((p) => {
        const pdf = isPdfUrl(p.url);
        return (
          <Pressable
            key={p.path}
            onPress={() => p.url && void Linking.openURL(p.url)}
            style={styles.photoTile}
            accessibilityRole="button"
            accessibilityLabel={pdf ? "Open PDF" : "Open photo"}
          >
            {pdf || !p.url ? (
              <View style={styles.photoTileDoc}>
                <Ionicons name="document-text" size={20} color={colors.primary} />
                <Text style={styles.photoTileDocText}>PDF</Text>
              </View>
            ) : (
              <Image source={{ uri: p.url }} style={styles.photoTileImg} />
            )}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function InfoBlock({
  icon,
  tone,
  title,
  body,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  tone: "primary" | "warning" | "muted";
  title: string;
  body: string;
}>) {
  const accent =
    tone === "warning" ? colors.warning : tone === "muted" ? colors.subtleText : colors.primary;
  return (
    <View
      style={[
        styles.infoBlock,
        tone === "warning" && styles.infoBlockWarning,
        tone === "muted" && styles.infoBlockMuted,
      ]}
    >
      <View style={styles.infoHeader}>
        <Ionicons name={icon} size={16} color={accent} />
        <Text style={styles.infoTitle}>{title}</Text>
      </View>
      <Text style={styles.infoBody}>{body}</Text>
    </View>
  );
}

function PickerChip({
  icon,
  label,
  onPress,
  disabled,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  disabled?: boolean;
}>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.pickerChip, disabled && styles.btnDisabled]}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <Text style={styles.pickerChipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "88%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2 },

  body: { maxHeight: 540 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  centered: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },

  stack: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },

  infoBlock: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(93, 63, 211, 0.28)",
    backgroundColor: colors.surfaceTintPrimary,
    padding: 14,
  },
  infoBlockWarning: {
    borderColor: "rgba(245, 158, 11, 0.40)",
    backgroundColor: colors.surfaceTintWarning,
  },
  infoBlockMuted: { borderColor: colors.border, backgroundColor: colors.surfaceMuted },
  infoHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 },
  infoTitle: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "800", lineHeight: 19 },
  infoBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19 },

  attemptsText: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "800" },

  // Photo strip (carrier / under-review view)
  photoStrip: { gap: 8, paddingVertical: 2 },
  photoTile: { width: 80, height: 80, borderRadius: 12, overflow: "hidden" },
  photoTileImg: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  photoTileDoc: {
    width: 80,
    height: 80,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
  },
  photoTileDocText: { color: colors.primary, fontSize: 10, fontWeight: "800" },

  // Staged file list (sender upload)
  fileList: { gap: 8 },
  fileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 8,
  },
  fileThumb: { width: 40, height: 40, borderRadius: 8 },
  fileThumbDoc: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  fileName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },

  // Pickers
  pickerRow: { flexDirection: "row", gap: 8 },
  pickerChip: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 16,
    borderRadius: 14,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(93, 63, 211, 0.40)",
    backgroundColor: colors.surfaceMuted,
  },
  pickerChipText: { color: colors.primary, fontSize: 12, fontWeight: "800" },

  // Reject reason
  reasonWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  reasonChip: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  reasonChipSelected: {
    borderColor: colors.primary,
    backgroundColor: colors.surfaceTintPrimary,
  },
  reasonChipText: { color: colors.mutedText, fontSize: 12, fontWeight: "700" },
  reasonChipTextSelected: { color: colors.primary },
  noteInput: {
    minHeight: 64,
    maxHeight: 140,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: colors.text,
    fontSize: 14,
    textAlignVertical: "top",
  },

  // Buttons
  btn: {
    minHeight: 44,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 16,
  },
  btnDisabled: { opacity: 0.5 },
  btnPrimary: { backgroundColor: colors.ctaAccent },
  btnPrimaryText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  btnDanger: { backgroundColor: colors.danger },
  btnDangerText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  btnWarning: { backgroundColor: colors.warning },
  btnWarningText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  btnMuted: { backgroundColor: colors.surfaceMuted },
  btnMutedText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  btnOutlineWarning: { borderWidth: 1, borderColor: "rgba(245, 158, 11, 0.55)" },
  btnOutlineWarningText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  btnOutlineDanger: { borderWidth: 1, borderColor: "rgba(220, 40, 40, 0.45)" },
  btnOutlineDangerText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
});

export default ParcelReviewModal;
