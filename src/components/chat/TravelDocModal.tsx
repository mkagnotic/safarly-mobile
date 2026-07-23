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
import { getErrorMessage, type RNUploadFile, type TravelDocState } from "@/services/api";
import { colors } from "@/theme/colors";

import type { TravelDocPending } from "@/hooks/api/useTravelDoc";

/** 10 MB — same cap as chat attachments and the web uploader. */
const MAX_FILE_BYTES = 10 * 1024 * 1024;

/** Web parity (`ChatDocVerifyPrompt.tsx:21`). */
const isPdfUrl = (u: string | null): boolean => !!u && /\.pdf(\?|$)/i.test(u);

interface TravelDocModalProps {
  open: boolean;
  doc: TravelDocState | null;
  loading: boolean;
  pending: TravelDocPending;
  onClose: () => void;
  onUpload: (file: RNUploadFile) => void;
  onApprove: () => void;
  onReject: (reason: string) => void;
  onRequestAdminReview: () => void;
  onCancelMatch: () => void;
}

/**
 * Travel-document verification, in-chat. Mobile counterpart of web's
 * `ChatDocVerifyPrompt`, opened from the workflow pin's "Upload" / "Review" CTA.
 *
 * Carrier uploads a boarding pass or flight ticket (image or PDF, capped tries);
 * the sender approves or asks for a re-upload with a reason; after the attempts
 * run out the carrier can escalate to admin or cancel the match. Approval is what
 * unlocks payment — enforced server-side, this is only the UI.
 */
export function TravelDocModal({
  open,
  doc,
  loading,
  pending,
  onClose,
  onUpload,
  onApprove,
  onReject,
  onRequestAdminReview,
  onCancelMatch,
}: Readonly<TravelDocModalProps>) {
  const [file, setFile] = useState<RNUploadFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Reset all local UI when the sheet closes so the next open starts clean.
  useEffect(() => {
    if (!open) {
      setFile(null);
      setPreviewUri(null);
      setRejecting(false);
      setReason("");
      setConfirmCancel(false);
    }
  }, [open]);

  // A fresh document arriving (status flip) clears the staged file — after a
  // successful upload the "under review" view should not still show a preview.
  useEffect(() => {
    setFile(null);
    setPreviewUri(null);
  }, [doc?.status, doc?.doc_url]);

  const pickImage = async () => {
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow photo access to attach a document.",
          variant: "warning",
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Files must be under 10 MB.", variant: "error" });
        return;
      }
      setFile({
        uri: asset.uri,
        name: asset.fileName ?? `travel-doc-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't pick image", message: getErrorMessage(err), variant: "error" });
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
        showToast({ title: "Too large", message: "Files must be under 10 MB.", variant: "error" });
        return;
      }
      setFile({
        uri: asset.uri,
        name: asset.fileName ?? `travel-doc-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      });
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't take photo", message: getErrorMessage(err), variant: "error" });
    }
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: "application/pdf",
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.size && asset.size > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Files must be under 10 MB.", variant: "error" });
        return;
      }
      setFile({
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/pdf",
      });
      setPreviewUri(null);
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  };

  const busy = pending !== null;

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
            <Ionicons name="shield-checkmark" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Travel verification</Text>
            <Text style={styles.subtitle}>Confirm the trip before payment.</Text>
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
          {loading && !doc ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : !doc ? (
            <Text style={styles.infoBody}>
              Verification isn&apos;t available for this conversation yet.
            </Text>
          ) : (
            <Content
              doc={doc}
              pending={pending}
              busy={busy}
              file={file}
              previewUri={previewUri}
              rejecting={rejecting}
              reason={reason}
              confirmCancel={confirmCancel}
              setReason={setReason}
              setRejecting={setRejecting}
              setConfirmCancel={setConfirmCancel}
              clearFile={() => {
                setFile(null);
                setPreviewUri(null);
              }}
              pickImage={pickImage}
              takePhoto={takePhoto}
              pickPdf={pickPdf}
              onUpload={() => file && onUpload(file)}
              onApprove={onApprove}
              onReject={() => reason.trim() && onReject(reason.trim())}
              onRequestAdminReview={onRequestAdminReview}
              onCancelMatch={onCancelMatch}
            />
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

interface ContentProps {
  doc: TravelDocState;
  pending: TravelDocPending;
  busy: boolean;
  file: RNUploadFile | null;
  previewUri: string | null;
  rejecting: boolean;
  reason: string;
  confirmCancel: boolean;
  setReason: (v: string) => void;
  setRejecting: (v: boolean) => void;
  setConfirmCancel: (v: boolean) => void;
  clearFile: () => void;
  pickImage: () => void;
  takePhoto: () => void;
  pickPdf: () => void;
  onUpload: () => void;
  onApprove: () => void;
  onReject: () => void;
  onRequestAdminReview: () => void;
  onCancelMatch: () => void;
}

function Content(props: Readonly<ContentProps>) {
  const { doc } = props;
  const isCarrier = doc.viewer_role === "carrier";
  const attemptsLeft = Math.max(0, doc.max_attempts - doc.attempts);
  const exhausted = doc.status === "rejected" && attemptsLeft <= 0;

  if (isCarrier) return <CarrierContent {...props} exhausted={exhausted} attemptsLeft={attemptsLeft} />;
  return <SenderContent {...props} />;
}

// ───────────────────────── Carrier ─────────────────────────

function CarrierContent(
  props: Readonly<ContentProps & { exhausted: boolean; attemptsLeft: number }>,
) {
  const {
    doc,
    pending,
    busy,
    file,
    previewUri,
    exhausted,
    attemptsLeft,
    confirmCancel,
    setConfirmCancel,
    clearFile,
    pickImage,
    takePhoto,
    pickPdf,
    onUpload,
    onRequestAdminReview,
    onCancelMatch,
  } = props;

  if (doc.status === "pending") {
    return (
      <InfoBlock
        icon="time-outline"
        tone="muted"
        title="Document under review"
        body="The sender is reviewing your travel document. You'll be notified once it's verified."
      />
    );
  }

  if (exhausted) {
    return (
      <View style={styles.stack}>
        <InfoBlock
          icon="alert-circle"
          tone="warning"
          title="Verification failed"
          body="We're unable to verify the travel document. Would you like our team to review it?"
        />
        {doc.escalated ? (
          <View style={styles.mutedPill}>
            <Text style={styles.mutedPillText}>
              Admin review requested — our team will follow up.
            </Text>
          </View>
        ) : (
          <Pressable
            onPress={onRequestAdminReview}
            disabled={busy}
            style={[styles.btn, styles.btnPrimary, busy && styles.btnDisabled]}
            accessibilityRole="button"
          >
            {pending === "admin" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.btnPrimaryText}>Request admin review</Text>
            )}
          </Pressable>
        )}
        {confirmCancel ? (
          <View style={styles.row}>
            <Pressable
              onPress={onCancelMatch}
              disabled={busy}
              style={[styles.btn, styles.btnDanger, styles.flex, busy && styles.btnDisabled]}
              accessibilityRole="button"
            >
              {pending === "withdraw" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnDangerText}>Yes, cancel match</Text>
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
            <Text style={styles.btnOutlineDangerText}>Cancel match</Text>
          </Pressable>
        )}
      </View>
    );
  }

  // none | rejected (with attempts left) → upload / re-upload
  const rejected = doc.status === "rejected";
  return (
    <View style={styles.stack}>
      <InfoBlock
        icon={rejected ? "alert-circle" : "document-attach-outline"}
        tone={rejected ? "warning" : "primary"}
        title={rejected ? "The sender asked for a new document." : "Upload your travel document"}
        body={
          rejected
            ? `Reason: ${doc.rejection_reason ?? "—"}`
            : "Add your boarding pass or flight ticket (image or PDF) so the sender can verify your trip."
        }
      />
      <Text style={styles.attemptsText}>
        {attemptsLeft} of {doc.max_attempts} upload{doc.max_attempts === 1 ? "" : "s"} remaining
      </Text>

      {file ? (
        <View style={styles.previewRow}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewThumb} />
          ) : (
            <View style={styles.previewFile}>
              <Ionicons name="document-text-outline" size={20} color={colors.primary} />
            </View>
          )}
          <Text style={styles.previewName} numberOfLines={1}>
            {file.name}
          </Text>
          <Pressable
            onPress={clearFile}
            hitSlop={6}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel="Remove file"
          >
            <Ionicons name="close-circle" size={22} color={colors.mutedText} />
          </Pressable>
        </View>
      ) : (
        <View style={styles.pickerRow}>
          <PickerChip icon="image" label="Photo" onPress={pickImage} disabled={busy} />
          <PickerChip icon="camera" label="Camera" onPress={takePhoto} disabled={busy} />
          <PickerChip icon="document-text" label="PDF" onPress={pickPdf} disabled={busy} />
        </View>
      )}

      <Pressable
        onPress={onUpload}
        disabled={!file || busy}
        style={[styles.btn, styles.btnPrimary, (!file || busy) && styles.btnDisabled]}
        accessibilityRole="button"
      >
        {pending === "upload" ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <Text style={styles.btnPrimaryText}>Upload document</Text>
        )}
      </Pressable>
    </View>
  );
}

// ───────────────────────── Sender ─────────────────────────

function SenderContent(props: Readonly<ContentProps>) {
  const {
    doc,
    pending,
    busy,
    rejecting,
    reason,
    setReason,
    setRejecting,
    onApprove,
    onReject,
  } = props;

  if (doc.status === "none") {
    return (
      <InfoBlock
        icon="time-outline"
        tone="muted"
        title="Awaiting the traveler's document"
        body="The traveler needs to upload a boarding pass or flight ticket before you can pay."
      />
    );
  }

  if (doc.status === "rejected") {
    return (
      <InfoBlock
        icon="time-outline"
        tone="muted"
        title="Re-upload requested"
        body="Waiting for the traveler to upload a new document."
      />
    );
  }

  // status === "pending" → sender reviews
  const pdf = isPdfUrl(doc.doc_url);
  return (
    <View style={styles.stack}>
      <InfoBlock
        icon="shield-checkmark"
        tone="primary"
        title="The traveler uploaded their travel document."
        body="Review it, then approve to unlock payment or ask for a re-upload."
      />

      {doc.doc_url ? (
        pdf ? (
          <Pressable
            onPress={() => void Linking.openURL(doc.doc_url as string)}
            style={styles.viewDocButton}
            accessibilityRole="button"
            accessibilityLabel="View document PDF"
          >
            <Ionicons name="document-text" size={16} color={colors.primary} />
            <Text style={styles.viewDocText}>View document (PDF)</Text>
            <Ionicons name="open-outline" size={14} color={colors.mutedText} />
          </Pressable>
        ) : (
          <Pressable
            onPress={() => void Linking.openURL(doc.doc_url as string)}
            accessibilityRole="button"
            accessibilityLabel="View full document"
          >
            <Image source={{ uri: doc.doc_url }} style={styles.docImage} resizeMode="contain" />
          </Pressable>
        )
      ) : null}

      {rejecting ? (
        <View style={styles.stack}>
          <TextInput
            value={reason}
            onChangeText={setReason}
            multiline
            maxLength={500}
            placeholder="Why does this need a re-upload? (e.g. blurry, wrong date)"
            placeholderTextColor={colors.subtleText}
            style={styles.reasonInput}
          />
          <View style={styles.row}>
            <Pressable
              onPress={onReject}
              disabled={!reason.trim() || busy}
              style={[
                styles.btn,
                styles.btnWarning,
                styles.flex,
                (!reason.trim() || busy) && styles.btnDisabled,
              ]}
              accessibilityRole="button"
            >
              {pending === "reject" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.btnWarningText}>Request re-upload</Text>
              )}
            </Pressable>
            <Pressable
              onPress={() => {
                setRejecting(false);
                setReason("");
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
              <Text style={styles.btnPrimaryText}>Approve</Text>
            )}
          </Pressable>
          <Pressable
            onPress={() => setRejecting(true)}
            disabled={busy}
            style={[styles.btn, styles.btnOutlineWarning, styles.flex]}
            accessibilityRole="button"
          >
            <Text style={styles.btnOutlineWarningText}>Request re-upload</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

// ───────────────────────── Small pieces ─────────────────────────

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
        <Text style={[styles.infoTitle]}>{title}</Text>
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

  body: { maxHeight: 520 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 16, paddingBottom: 28 },
  centered: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },

  stack: { gap: 12 },
  row: { flexDirection: "row", gap: 8 },
  flex: { flex: 1 },

  // Info block
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

  // File picker
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

  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 10,
  },
  previewThumb: { width: 44, height: 44, borderRadius: 8 },
  previewFile: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  previewName: { flex: 1, color: colors.text, fontSize: 13, fontWeight: "700" },

  // Sender doc view
  viewDocButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },
  viewDocText: { flex: 1, color: colors.primary, fontSize: 13, fontWeight: "800" },
  docImage: {
    width: "100%",
    height: 220,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
  },

  reasonInput: {
    minHeight: 72,
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

  mutedPill: {
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  mutedPillText: { color: colors.mutedText, fontSize: 12, fontWeight: "600", textAlign: "center" },

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

export default TravelDocModal;
