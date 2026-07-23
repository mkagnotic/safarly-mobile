import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { ActivityIndicator, Image, StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { supabase } from "@/integrations/supabase/client";
import { colors } from "@/theme/colors";

type Props = {
  userId: string;
  currentUrl?: string | null;
  initials: string;
  onChange: (url: string | null) => void;
  disabled?: boolean;
};

type Status =
  | { kind: "warning"; title: string; message: string }
  | { kind: "error"; title: string; message: string }
  | null;

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED_MIME = new Set(["image/jpeg", "image/png", "image/webp"]);

export function AvatarUpload({ userId, currentUrl, initials, onChange, disabled }: Readonly<Props>) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentUrl ?? null);
  const [uploading, setUploading] = useState(false);
  const [status, setStatus] = useState<Status>(null);

  // Follow the parent's `currentUrl` when it seeds/changes after mount — e.g. the
  // edit screen hydrates from the loaded profile a tick after this mounts. Every
  // internal change (pick/remove) also flows through `onChange` → the parent →
  // back here as the same value, so this never fights a user action.
  useEffect(() => {
    setPreviewUrl(currentUrl ?? null);
  }, [currentUrl]);

  const pickAndUpload = async () => {
    if (uploading || disabled) return;
    setStatus(null);
    try {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (perm.status !== "granted") {
        setStatus({
          kind: "warning",
          title: "Permission needed",
          message: "Allow photo access to upload a profile picture.",
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
        setStatus({ kind: "error", title: "Unsupported format", message: "Use JPG, PNG, or WebP." });
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        setStatus({ kind: "error", title: "Too large", message: "Image must be under 5 MB." });
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
        setStatus({ kind: "error", title: "Upload failed", message: uploadError.message });
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(filePath);
      const cacheBusted = `${data.publicUrl}?t=${Date.now()}`;
      setPreviewUrl(cacheBusted);
      onChange(cacheBusted);
    } catch (err) {
      setStatus({
        kind: "error",
        title: "Couldn't upload photo",
        message: err instanceof Error ? err.message : "Try again in a moment.",
      });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    if (uploading || disabled) return;
    setStatus(null);
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
      {status ? (
        <View
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={[styles.statusRow, status.kind === "warning" ? styles.statusWarn : styles.statusError]}
        >
          <Ionicons
            name={status.kind === "warning" ? "warning" : "alert-circle"}
            size={14}
            color={status.kind === "warning" ? colors.warning : colors.danger}
            style={styles.statusIcon}
          />
          <Text
            style={[
              styles.statusText,
              { color: status.kind === "warning" ? colors.warning : colors.danger },
            ]}
          >
            <Text style={styles.statusTitle}>{status.title}. </Text>
            {status.message}
          </Text>
        </View>
      ) : null}
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
  statusRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 1,
    maxWidth: 280,
  },
  statusWarn: {
    backgroundColor: "rgba(245, 159, 10, 0.10)",
    borderColor: "rgba(245, 159, 10, 0.36)",
  },
  statusError: {
    backgroundColor: "rgba(220, 40, 40, 0.08)",
    borderColor: "rgba(220, 40, 40, 0.32)",
  },
  statusIcon: { marginTop: 1 },
  statusText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: "500" },
  statusTitle: { fontWeight: "800" },
});
