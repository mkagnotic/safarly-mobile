import { useCallback, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { showToast } from "@/feedback/appFeedback";
import { type UseChatMessagesResult } from "@/hooks/api/useChatMessages";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { LIBRARY_PICK_OPTIONS, requestLibraryPermission } from "@/lib/imagePicker";
import { getErrorMessage, type RNUploadFile } from "@/services/api";
import { notifyPermissionDenied } from "@/utils/permissionBanner";

import { MAX_FILE_BYTES, MAX_VIDEO_BYTES } from "../chatHelpers";

interface UseChatComposerInput {
  canSend: boolean;
  send: UseChatMessagesResult["send"];
  notifyTyping: () => void;
  stopTyping: () => void;
}

/**
 * The composer: draft text, the pending attachment (pick / preview / retry), the
 * attach sheet and the emoji picker, and sending.
 */
export function useChatComposer({ canSend, send, notifyTyping, stopTyping }: UseChatComposerInput) {
  const [draft, setDraft] = useState("");
  const [pendingFile, setPendingFile] = useState<RNUploadFile | null>(null);
  const [previewUri, setPreviewUri] = useState<string | null>(null);
  // Tracks whether the LAST send attempt for `pendingFile` failed, so the
  // composer preview row can show a retry icon (web parity:
  // CustomerMessages.tsx:905-908). Cleared whenever a new file is picked or
  // a send succeeds.
  const [uploadFailed, setUploadFailed] = useState(false);
  // Two separate sheets: the composer paperclip opens the attach sheet; the
  // header kebab opens the conversation-actions sheet (web parity).
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  // iOS can't present a Modal (or a native picker) while another is still
  // fading out, so anything opened from a sheet waits for it to dismiss.
  const { after: afterAttachMenu, onDismiss: onAttachMenuDismissed } = useModalHandoff();
  const [emojiOpen, setEmojiOpen] = useState(false);

  const handlePickImage = useCallback(async () => {
    try {
      const perm = await requestLibraryPermission();
      if (perm.status !== "granted") {
        notifyPermissionDenied("photos", perm, "attach images");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        ...LIBRARY_PICK_OPTIONS,
        // SDK 54 deprecated MediaTypeOptions in favor of the string-array form.
        mediaTypes: ["images"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({ title: "Too large", message: "Images must be 5 MB or smaller.", variant: "error" });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.fileName ?? `photo-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      setPendingFile(file);
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't pick image", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const handleTakePhoto = useCallback(async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        notifyPermissionDenied("camera", perm, "take photos");
        return;
      }
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      // Same 5 MB cap as the library picker — high-res phones can produce
      // larger raw captures.
      if (asset.fileSize && asset.fileSize > MAX_FILE_BYTES) {
        showToast({
          title: "Too large",
          message: "Photos must be 5 MB or smaller.",
          variant: "error",
        });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.fileName ?? `camera-${Date.now()}.jpg`,
        type: asset.mimeType ?? "image/jpeg",
      };
      setPendingFile(file);
      setPreviewUri(asset.uri);
    } catch (err) {
      showToast({ title: "Couldn't take photo", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "application/pdf",
          "application/msword",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "video/*",
        ],
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const isVideo = (asset.mimeType ?? "").startsWith("video/");
      if (asset.size && asset.size > (isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES)) {
        showToast({
          title: "Too large",
          message: isVideo ? "Videos must be 10 MB or smaller." : "Documents must be 5 MB or smaller.",
          variant: "error",
        });
        return;
      }
      const file: RNUploadFile = {
        uri: asset.uri,
        name: asset.name,
        type: asset.mimeType ?? "application/octet-stream",
      };
      setPendingFile(file);
      setPreviewUri(null);
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  }, []);

  const clearPending = useCallback(() => {
    setPendingFile(null);
    setPreviewUri(null);
    setUploadFailed(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed && !pendingFile) return;
    if (!canSend) return;
    const fileToSend = pendingFile;
    const draftSnapshot = trimmed;
    // Clear text immediately for responsive feel; keep the file in the
    // preview row until we know whether the upload+send succeeded so the
    // user can retry it without re-picking.
    setDraft("");
    setUploadFailed(false);
    stopTyping();
    try {
      await send({ text: draftSnapshot, file: fileToSend });
      // Success: drop the preview now that the bubble is in flight.
      if (fileToSend) clearPending();
    } catch (err) {
      // Restore the draft text so the user doesn't lose what they typed.
      if (draftSnapshot) setDraft(draftSnapshot);
      if (fileToSend) setUploadFailed(true);
      showToast({
        title: "Couldn't send",
        message: getErrorMessage(err),
        variant: "error",
      });
    }
  }, [draft, pendingFile, canSend, clearPending, send, stopTyping]);

  // Same as `handleSend` but always retries with the current pending file —
  // bound to the retry icon on the preview row.
  const handleRetryUpload = useCallback(() => {
    if (!pendingFile) return;
    void handleSend();
  }, [pendingFile, handleSend]);

  const handleDraftChange = useCallback(
    (next: string) => {
      setDraft(next);
      if (next.length > 0) notifyTyping();
      else stopTyping();
    },
    [notifyTyping, stopTyping],
  );

  return {
    draft,
    setDraft,
    pendingFile,
    previewUri,
    uploadFailed,
    attachMenuOpen,
    setAttachMenuOpen,
    afterAttachMenu,
    onAttachMenuDismissed,
    emojiOpen,
    setEmojiOpen,
    handlePickImage,
    handleTakePhoto,
    handlePickDocument,
    clearPending,
    handleSend,
    handleRetryUpload,
    handleDraftChange,
  };
}

export type ChatComposerController = ReturnType<typeof useChatComposer>;
