import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Image, StyleSheet, Text, TextInput, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

import { type ChatComposerController } from "../hooks/useChatComposer";

interface ChatComposerProps {
  composer: ChatComposerController;
  composerBottomPad: number;
  uploading: boolean;
  stopTyping: () => void;
}

/** ───────── Composer ───────── */
export function ChatComposer({
  composer,
  composerBottomPad,
  uploading,
  stopTyping,
}: Readonly<ChatComposerProps>) {
  const {
    draft,
    pendingFile,
    previewUri,
    uploadFailed,
    setAttachMenuOpen,
    setEmojiOpen,
    handleDraftChange,
    handleSend,
    handleRetryUpload,
    clearPending,
  } = composer;

  return (
    <View style={[styles.composerWrap, { paddingBottom: composerBottomPad }]}>
      {pendingFile ? (
        <View style={[styles.previewRow, uploadFailed && styles.previewRowFailed]}>
          {previewUri ? (
            <Image source={{ uri: previewUri }} style={styles.previewThumb} />
          ) : (
            <View style={styles.previewFile}>
              <Ionicons
                name="document-text-outline"
                size={20}
                color={colors.primary}
              />
            </View>
          )}
          <View style={styles.previewBody}>
            <Text style={styles.previewName} numberOfLines={1}>
              {pendingFile.name}
            </Text>
            <Text
              style={[
                styles.previewType,
                uploadFailed && { color: colors.danger, fontWeight: "700" },
              ]}
            >
              {uploadFailed
                ? "Upload failed — tap retry"
                : uploading
                  ? "Uploading…"
                  : pendingFile.type}
            </Text>
          </View>
          {uploadFailed ? (
            <Pressable
              onPress={handleRetryUpload}
              hitSlop={6}
              style={styles.previewRetryButton}
              accessibilityRole="button"
              accessibilityLabel="Retry upload"
            >
              <Ionicons name="refresh" size={18} color={colors.white} />
            </Pressable>
          ) : null}
          <Pressable
            onPress={clearPending}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel="Remove attachment"
          >
            <Ionicons name="close-circle" size={22} color={colors.mutedText} />
          </Pressable>
        </View>
      ) : null}
      <View style={styles.composerRow}>
        {/*
          The make-offer entry point lives on the workflow pin's "Offer" CTA
          and the live-offer bar, so the composer price-tag icon was a
          redundant third way in — removed to keep the composer clean.
        */}
        <Pressable
          onPress={() => setAttachMenuOpen(true)}
          style={styles.composerIconButton}
          accessibilityRole="button"
          accessibilityLabel="Attach"
          disabled={uploading}
        >
          <Ionicons name="attach" size={22} color={colors.mutedText} />
        </Pressable>
        <Pressable
          onPress={() => setEmojiOpen(true)}
          style={styles.composerIconButton}
          accessibilityRole="button"
          accessibilityLabel="Insert emoji"
          disabled={uploading}
        >
          <Ionicons name="happy" size={22} color={colors.mutedText} />
        </Pressable>
        <TextInput
          value={draft}
          onChangeText={handleDraftChange}
          onBlur={stopTyping}
          placeholder={uploading ? "Uploading…" : "Type a message"}
          placeholderTextColor={colors.subtleText}
          style={styles.composerInput}
          multiline
          editable={!uploading}
        />
        <Pressable
          onPress={() => void handleSend()}
          disabled={uploading || (!draft.trim() && !pendingFile)}
          style={[
            styles.sendButton,
            (uploading || (!draft.trim() && !pendingFile)) && styles.sendButtonDisabled,
          ]}
          accessibilityRole="button"
          accessibilityLabel="Send"
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="send" size={16} color={colors.white} />
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Composer
  composerWrap: {
    backgroundColor: colors.card,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingHorizontal: 12,
    paddingTop: 8,
    // paddingBottom is applied inline from the safe-area inset.
    gap: 8,
  },
  previewRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 10,
    padding: 8,
  },
  previewRowFailed: {
    backgroundColor: "rgba(220, 40, 40, 0.08)",
    borderWidth: 1,
    borderColor: colors.danger,
  },
  previewRetryButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
  },
  previewThumb: { width: 40, height: 40, borderRadius: 6 },
  previewFile: {
    width: 40,
    height: 40,
    borderRadius: 6,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  previewBody: { flex: 1, minWidth: 0 },
  previewName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  previewType: { color: colors.mutedText, fontSize: 11 },
  composerRow: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  composerIconButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },
  composerInput: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 19,
    paddingHorizontal: 14,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
  },
  sendButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
  },
  sendButtonDisabled: { opacity: 0.5 },
});
