import { Ionicons } from "@expo/vector-icons";
import { Image, Linking, StyleSheet, Text } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

// ───────────────────────── Attachment ─────────────────────────

interface AttachmentProps {
  url: string;
  type: string;
  onOpenImage: (url: string) => void;
}

export function Attachment({ url, type, onOpenImage }: Readonly<AttachmentProps>) {
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
  const fileName = type.includes("pdf")
    ? "PDF Document"
    : type.includes("word")
      ? "Word Document"
      : type.startsWith("video/")
        ? "Video"
        : "Document";
  const icon: keyof typeof Ionicons.glyphMap = type.startsWith("video/")
    ? "videocam"
    : type.includes("pdf")
      ? "document-text-outline"
      : "document-attach";
  return (
    <Pressable
      onPress={() => {
        void Linking.openURL(url);
      }}
      style={styles.attachmentDocCard}
      accessibilityRole="button"
      accessibilityLabel={`Open ${fileName}`}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.attachmentDocName}>{fileName}</Text>
      <Ionicons name="open" size={14} color={colors.mutedText} />
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
