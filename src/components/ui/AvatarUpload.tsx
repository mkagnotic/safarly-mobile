import { useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

type Props = {
  userId: string;
  currentUrl?: string | null;
  initials: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function AvatarUpload({ userId, currentUrl, initials, onChange, disabled }: Readonly<Props>) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);

  const pickAndUpload = async () => {
    if (uploading || disabled) return;
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        showToast({
          title: "Permission needed",
          message: "Allow photo access to upload a profile picture.",
          variant: "warning",
        });
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.85,
      });
      if (result.canceled || !result.assets?.[0]) return;
      const asset = result.assets[0];

      if (asset.mimeType && !ALLOWED_MIME.has(asset.mimeType)) {
        showToast({ title: "Unsupported format", message: "Use JPG, PNG, or WebP.", variant: "error" });
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        showToast({ title: "Too large", message: "Image must be under 5 MB.", variant: "error" });
        return;
      }

      setUploading(true);
      const arrayBuffer = await (await fetch(asset.uri)).arrayBuffer();
      const ext = asset.mimeType === "image/png" ? "png" : asset.mimeType === "image/webp" ? "webp" : "jpg";
      const filePath = `${userId}/avatar-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(filePath, arrayBuffer, {
          contentType: asset.mimeType ?? "image/jpeg",
          upsert: true,
        });
      if (uploadError) {
        showToast({ title: "Upload failed", message: uploadError.message, variant: "error" });
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const cacheBusted = `${data.publicUrl}?t=${Date.now()}`;
      setPreviewUrl(cacheBusted);
      onChange(cacheBusted);
    } catch (err) {
      showToast({
        title: "Couldn't upload photo",
        message: err instanceof Error ? err.message : "Try again in a moment.",
        variant: "error",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (uploading || disabled) return;
    setPreviewUrl(null);
    onChange(null);
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.avatarRing}>
        {previewUrl ? (
          <Image source={{ uri: previewUrl }} style={styles.avatarImage} accessibilityIgnoresInvertColors />
        ) : (
          <View style={styles.avatarFallback}>
            <Text style={styles.avatarInitials}>{initials}</Text>
          </View>
        )}
        {previewUrl && !uploading ? (
          <Pressable
            style={styles.removeButton}
            onPress={handleRemove}
            disabled={disabled}
            accessibilityRole="button"
            accessibilityLabel="Remove profile photo"
            hitSlop={4}
          >
            <Ionicons name="close" size={14} color={colors.white} />
          </Pressable>
        ) : null}
        <Pressable
          style={styles.cameraButton}
          onPress={pickAndUpload}
          disabled={uploading || disabled}
          accessibilityRole="button"
          accessibilityLabel={previewUrl ? "Change profile photo" : "Add profile photo"}
        >
          {uploading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Ionicons name="camera" size={16} color={colors.white} />
          )}
        </Pressable>
      </View>
      <Pressable
        onPress={pickAndUpload}
        disabled={uploading || disabled}
        hitSlop={4}
        accessibilityRole="button"
      >
        <Text style={[styles.linkText, (uploading || disabled) && styles.linkTextDisabled]}>
          {uploading ? "Uploading…" : previewUrl ? "Change photo" : "Add photo"}
        </Text>
      </Pressable>
    </View>
  );
}

const AVATAR_SIZE = 96;
const CAMERA_SIZE = 32;

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 8 },
  avatarRing: { width: AVATAR_SIZE, height: AVATAR_SIZE },
  avatarImage: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: colors.surfaceMuted,
  },
  avatarFallback: {
    width: AVATAR_SIZE,
    height: AVATAR_SIZE,
    borderRadius: AVATAR_SIZE / 2,
    backgroundColor: "rgba(249, 115, 22, 0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInitials: { color: colors.ctaAccent, fontSize: 32, fontWeight: "800" },
  cameraButton: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: CAMERA_SIZE,
    height: CAMERA_SIZE,
    borderRadius: CAMERA_SIZE / 2,
    backgroundColor: colors.ctaAccent,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  removeButton: {
    position: "absolute",
    left: -2,
    top: -2,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: colors.card,
  },
  linkText: { color: colors.ctaAccent, fontSize: 13, fontWeight: "700" },
  linkTextDisabled: { opacity: 0.5 },
});
