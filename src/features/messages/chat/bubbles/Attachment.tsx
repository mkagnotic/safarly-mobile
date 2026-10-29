import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Alert, Image, Linking, StyleSheet, Text } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

import { attachmentLabel } from "../lib/chatAttachments";

// ───────────────────────── Attachment ─────────────────────────

interface AttachmentProps {
  url: string;
  type: string;
  /** The stored file name (attachment_name); the type label is the fallback (= web). */
  name?: string | null;
  onOpenImage: (url: string) => void;
}

export function Attachment({ url, type, name, onOpenImage }: Readonly<AttachmentProps>) {
  const [opening, setOpening] = useState(false);
  if (type.startsWith("image/")) {
    return (
      <Pressable
        onPress={() => onOpenImage(url)}
        accessibilityRole="image"
        accessibilityLabel="Tap to expand"
      >
        <Image source={{ uri: url }} style={styles.attachmentImage} resizeMode="cover" />
      </Pressable>
    );
  }
  const fileName = attachmentLabel(name, type);
  const icon: keyof typeof Ionicons.glyphMap = type.startsWith("video/")
    ? "videocam"
    : type.includes("pdf")
      ? "document-text-outline"
      : "document-attach";
  return (
    <Pressable
      onPress={async () => {
        if (opening) return;
        setOpening(true);
        try {
          await Linking.openURL(url);
        } catch {
          // Same pattern as TravelDocModal: a failed open says so.
          Alert.alert("Couldn't open the file", "Please try again.");
        } finally {
          setOpening(false);
        }
      }}
      disabled={opening}
      style={styles.attachmentDocCard}
      accessibilityRole="button"
      accessibilityLabel={`Open ${fileName}`}
      accessibilityState={{ busy: opening }}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.attachmentDocName} numberOfLines={1}>{opening ? "Opening…" : fileName}</Text>
      {opening ? (
        <ActivityIndicator size="small" color={colors.mutedText} />
      ) : (
        <Ionicons name="open" size={14} color={colors.mutedText} />
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Attachments
  attachmentImage: {
    width: 200,
    height: 160,
    borderRadius: 10,
    backgroundColor: colors.surfaceMuted,
  },
  attachmentDocCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 10,
  },
  attachmentDocName: { color: colors.text, fontSize: 12, fontWeight: "700", flex: 1 },
});
