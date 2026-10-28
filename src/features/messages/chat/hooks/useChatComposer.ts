import { useCallback, useRef, useState } from "react";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { showToast } from "@/feedback/appFeedback";
import { type UseChatMessagesResult } from "@/hooks/api/useChatMessages";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { LIBRARY_PICK_OPTIONS, requestLibraryPermission } from "@/lib/imagePicker";
import { getErrorMessage, type RNUploadFile } from "@/services/api";
import { notifyPermissionDenied } from "@/utils/permissionBanner";

import { attachmentProblem, DOCUMENT_PICKER_TYPES, resolveAttachmentType } from "../lib/chatAttachments";
import { ChatSendError, MESSAGE_MAX_LENGTH, sendFailurePlan } from "../lib/chatSendRules";

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
  const sendingRef = useRef(false);

  /**
   * Stage a picked file after the SERVER's checks (allow-list + size; see
   * lib/chatAttachments). A file the server would refuse is never uploaded.
   */
  const stageFile = useCallback(
    (asset: { uri: string; name?: string | null; mimeType?: string | null; size?: number | null }, fallbackName: string, preview: boolean) => {
      const name = asset.name || fallbackName;
      const type = resolveAttachmentType(asset.mimeType, name);
      const problem = attachmentProblem(type, asset.size);
      if (problem) {
        showToast({ title: "Can't attach this file", message: problem, variant: "error" });
        return;
      }
      setPendingFile({ uri: asset.uri, name, type: type! });
      setPreviewUri(preview && type!.startsWith("image/") ? asset.uri : null);
      setUploadFailed(false);
    },
    [],
  );

  const handlePickImage = useCallback(async () => {
    try {
      const perm = await requestLibraryPermission();
      if (perm.status !== "granted") {
        notifyPermissionDenied("photos", perm, "attach images");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        ...LIBRARY_PICK_OPTIONS,
        // "Photo or video" (= web's photo input, which takes video too).
        // SDK 54 deprecated MediaTypeOptions in favor of the string-array form.
        mediaTypes: ["images", "videos"],
        quality: 0.8,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      const isVideo = asset.type === "video" || (asset.mimeType ?? "").startsWith("video/");
      stageFile(
        { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType ?? (isVideo ? null : "image/jpeg"), size: asset.fileSize },
        isVideo ? `video-${Date.now()}.mp4` : `photo-${Date.now()}.jpg`,
        true,
      );
    } catch (err) {
      showToast({ title: "Couldn't pick image", message: getErrorMessage(err), variant: "error" });
    }
  }, [stageFile]);

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
      stageFile(
        { uri: asset.uri, name: asset.fileName, mimeType: asset.mimeType ?? "image/jpeg", size: asset.fileSize },
        `camera-${Date.now()}.jpg`,
        true,
      );
    } catch (err) {
      showToast({ title: "Couldn't take photo", message: getErrorMessage(err), variant: "error" });
    }
  }, [stageFile]);

  const handlePickDocument = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        // PDF and Word only - videos come from "Photo or video".
        type: DOCUMENT_PICKER_TYPES,
        copyToCacheDirectory: true,
        multiple: false,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];
      stageFile({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType, size: asset.size }, `document-${Date.now()}`, false);
    } catch (err) {
      showToast({ title: "Couldn't pick file", message: getErrorMessage(err), variant: "error" });
    }
  }, [stageFile]);

  const clearPending = useCallback(() => {
    setPendingFile(null);
    setPreviewUri(null);
    setUploadFailed(false);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = draft.trim();
    if (!trimmed && !pendingFile) return;
    if (!canSend) return;
    // The input is locked while uploading; this stops a second tap that lands
    // before the lock has rendered (no double send).
    if (sendingRef.current) return;
    sendingRef.current = true;
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
      // ONE failure signal (chat spec bugs 9/10, lib/chatSendRules): a failed
      // upload -> the composer preview; a failed send -> the failed bubble; a
      // refusal a retry can't fix -> the server's reason + the text back.
      const plan = sendFailurePlan({
        phase: err instanceof ChatSendError ? err.phase : "send",
        hadFile: !!fileToSend,
        code: err instanceof ChatSendError ? err.code : null,
        message: getErrorMessage(err instanceof ChatSendError ? err.original : err),
      });
      if (plan.restoreDraft && draftSnapshot) setDraft(draftSnapshot);
      if (fileToSend) {
        if (plan.keepFile) setUploadFailed(true);
        else clearPending();
      }
      if (plan.notice) showToast({ title: "Couldn't send", message: plan.notice, variant: "error" });
    } finally {
      sendingRef.current = false;
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
      // The input's maxLength stops typing; this also caps a paste / emoji insert.
      setDraft(next.length > MESSAGE_MAX_LENGTH ? next.slice(0, MESSAGE_MAX_LENGTH) : next);
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
