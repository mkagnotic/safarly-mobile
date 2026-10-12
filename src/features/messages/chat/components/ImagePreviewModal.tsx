import { Ionicons } from "@expo/vector-icons";
import { Image, Modal, StyleSheet } from "react-native";
import { type EdgeInsets } from "react-native-safe-area-context";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

interface ImagePreviewModalProps {
  expandedImageUrl: string | null;
  setExpandedImageUrl: (url: string | null) => void;
  insets: EdgeInsets;
}

/** ───────── Expanded image preview ───────── */
export function ImagePreviewModal({
  expandedImageUrl,
  setExpandedImageUrl,
  insets,
}: Readonly<ImagePreviewModalProps>) {
  return (
    <Modal
      visible={!!expandedImageUrl}
      transparent
      animationType="fade"
      onRequestClose={() => setExpandedImageUrl(null)}
    >
      <Pressable
        style={styles.imageBackdrop}
        onPress={() => setExpandedImageUrl(null)}
      >
        {expandedImageUrl ? (
          <Image
            source={{ uri: expandedImageUrl }}
            style={styles.expandedImage}
            resizeMode="contain"
          />
        ) : null}
      </Pressable>
      <Pressable
        onPress={() => setExpandedImageUrl(null)}
        style={[styles.imageCloseButton, { top: insets.top + 8 }]}
        hitSlop={12}
        accessibilityRole="button"
        accessibilityLabel="Close image"
      >
        <Ionicons name="close" size={24} color={colors.white} />
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  // Expanded image
  imageBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  expandedImage: { width: "100%", height: "100%" },
  imageCloseButton: {
    position: "absolute",
    top: 48,
    right: 18,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
