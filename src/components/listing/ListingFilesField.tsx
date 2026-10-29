import { useEffect, useState } from "react";
import { ActivityIndicator, Image, Linking, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import * as DocumentPicker from "expo-document-picker";
import * as ImagePicker from "expo-image-picker";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { LIBRARY_PICK_OPTIONS, requestLibraryPermission } from "@/lib/imagePicker";
import { getErrorMessage, type RNUploadFile } from "@/services/api";
import {
  LISTING_FILES_MAX,
  listingFilesApi,
  type ListingFile,
  type ListingFileKind,
} from "@/services/api/listingFiles";
import { colors } from "@/theme/colors";
import { permissionDeniedBanner, type PermissionBanner } from "@/utils/permissionBanner";

const MAX_BYTES = 10 * 1024 * 1024;
const IMAGE_NAME = /\.(jpe?g|png|webp|gif|heic|heif)$/i;

/** A saved file has only a name; a staged one also has its MIME type. */
function isImageFile(name: string, type?: string | null): boolean {
  return type ? type.startsWith("image/") : IMAGE_NAME.test(name);
}

/**
 * The optional files field on the trip and parcel forms (client, 26 Oct 2026).
 *
 * - Create (no `listingId`): files are only STAGED; the screen uploads them right
 *   after the listing is saved (`uploadStagedListingFiles`).
 * - Edit (`listingId`): shows the saved files (open / remove) and adds more at once.
 *
 * Owner-only and separate from the deal's verification steps - it never counts
 * toward the 1-3 travel-document or 3-5 parcel-photo rules. Web parity:
 * src/components/listing/ListingFilesField.tsx.
 */
export function ListingFilesField({
  kind,
  listingId,
  staged,
  onStagedChange,
  label,
  hint,
}: Readonly<{
  kind: ListingFileKind;
  listingId?: string;
  staged?: RNUploadFile[];
  onStagedChange?: (files: RNUploadFile[]) => void;
  label: string;
  hint: string;
}>) {
  const max = LISTING_FILES_MAX[kind];
  const [saved, setSaved] = useState<ListingFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [banner, setBanner] = useState<PermissionBanner | null>(null);

  useEffect(() => {
    if (!listingId) return;
    let cancelled = false;
    listingFilesApi.list(kind, listingId)
      .then((r) => { if (!cancelled) setSaved(r.data?.files ?? []); })
      .catch(() => { /* a load failure leaves the field empty; adding still works */ });
    return () => { cancelled = true; };
  }, [kind, listingId]);

  const count = listingId ? saved.length : (staged?.length ?? 0);
  const room = Math.max(0, max - count);

  const add = async (picked: Array<RNUploadFile & { size?: number | null }>) => {
    setError(null);
    let ok = picked.filter((f) => !f.size || f.size <= MAX_BYTES);
    if (ok.length < picked.length) setError("Each file must be under 10 MB.");
    ok = ok.slice(0, room);
    if (!ok.length) return;
    const files = ok.map(({ uri, name, type }) => ({ uri, name, type }));
    if (!listingId) {
      onStagedChange?.([...(staged ?? []), ...files]);
      return;
    }
    setBusy(true);
    try {
      const r = await listingFilesApi.add(kind, listingId, files);
      setSaved(r.data?.files ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const pickPhotos = async () => {
    try {
      const perm = await requestLibraryPermission();
      if (perm.status !== "granted") {
        setBanner(permissionDeniedBanner("photos", perm, "attach a file"));
        return;
      }
      setBanner(null);
      const result = await ImagePicker.launchImageLibraryAsync({
        ...LIBRARY_PICK_OPTIONS,
        mediaTypes: ["images"],
        quality: 0.8,
        allowsMultipleSelection: room > 1,
        selectionLimit: room,
      });
      if (result.canceled || !result.assets?.length) return;
      await add(result.assets.map((a, i) => ({
        uri: a.uri, name: a.fileName ?? `${kind}-file-${Date.now()}-${i}.jpg`, type: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null,
      })));
    } catch (err) {
      setError(`Couldn't pick a photo. ${getErrorMessage(err)}`);
    }
  };

  const takePhoto = async () => {
    try {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (perm.status !== "granted") {
        setBanner(permissionDeniedBanner("camera", perm, "take a photo"));
        return;
      }
      setBanner(null);
      const result = await ImagePicker.launchCameraAsync({ quality: 0.8 });
      if (result.canceled || !result.assets?.[0]) return;
      const a = result.assets[0];
      await add([{ uri: a.uri, name: a.fileName ?? `${kind}-photo-${Date.now()}.jpg`, type: a.mimeType ?? "image/jpeg", size: a.fileSize ?? null }]);
    } catch (err) {
      setError(`Couldn't take a photo. ${getErrorMessage(err)}`);
    }
  };

  const pickPdf = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({ type: "application/pdf", copyToCacheDirectory: true, multiple: room > 1 });
      if (result.canceled || !result.assets?.length) return;
      await add(result.assets.map((a) => ({ uri: a.uri, name: a.name, type: a.mimeType ?? "application/pdf", size: a.size ?? null })));
    } catch (err) {
      setError(`Couldn't pick a file. ${getErrorMessage(err)}`);
    }
  };

  const removeSaved = async (path: string) => {
    if (!listingId) return;
    setBusy(true);
    setError(null);
    try {
      const r = await listingFilesApi.remove(kind, listingId, path);
      setSaved(r.data?.files ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const rows = listingId
    ? saved.map((f) => ({
        key: f.path, name: f.name, url: f.url, preview: isImageFile(f.name) ? f.url : null,
        onRemove: () => void removeSaved(f.path),
      }))
    : (staged ?? []).map((f, i) => ({
        key: `${f.uri}-${i}`, name: f.name, url: null as string | null,
        preview: isImageFile(f.name, f.type) ? f.uri : null,
        onRemove: () => onStagedChange?.((staged ?? []).filter((_, j) => j !== i)),
      }));

  return (
    <View style={styles.wrap} testID={`listing-files-${kind}`}>
      <Text style={styles.label}>
        {label} <Text style={styles.optional}>(Optional)</Text>
      </Text>
      {banner ? (
        <FormBanner
          variant={banner.variant}
          title={banner.title}
          message={banner.message}
          actionLabel={banner.actionLabel}
          onAction={banner.onAction}
        />
      ) : null}
      {rows.map((r) => (
        <View key={r.key} style={styles.row}>
          <Pressable
            onPress={() => { if (r.url) void Linking.openURL(r.url).catch(() => undefined); }}
            disabled={!r.url}
            accessibilityRole={r.url ? "button" : "image"}
            accessibilityLabel={r.url ? `Open ${r.name}` : r.name}
          >
            {r.preview ? (
              <Image source={{ uri: r.preview }} style={styles.thumb} testID="listing-file-thumb" />
            ) : (
              <View style={[styles.thumb, styles.docThumb]}>
                <Ionicons name="document-text-outline" size={20} color={colors.primary} />
              </View>
            )}
          </Pressable>
          {r.url ? (
            <Text
              style={[styles.name, styles.link]}
              numberOfLines={1}
              onPress={() => { if (r.url) void Linking.openURL(r.url).catch(() => undefined); }}
            >
              {r.name}
            </Text>
          ) : (
            <Text style={styles.name} numberOfLines={1}>{r.name}</Text>
          )}
          <Pressable
            onPress={r.onRemove}
            disabled={busy}
            hitSlop={6}
            accessibilityRole="button"
            accessibilityLabel={`Remove ${r.name}`}
          >
            <Ionicons name="close-circle" size={22} color={colors.mutedText} />
          </Pressable>
        </View>
      ))}
      {room > 0 ? (
        <View style={styles.chips}>
          <Chip icon="image" label="Photos" onPress={() => void pickPhotos()} disabled={busy} />
          <Chip icon="camera" label="Camera" onPress={() => void takePhoto()} disabled={busy} />
          <Chip icon="document-text" label="PDF" onPress={() => void pickPdf()} disabled={busy} />
        </View>
      ) : null}
      {busy ? <ActivityIndicator size="small" color={colors.primary} /> : null}
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Text style={styles.hint}>{count}/{max} files - {hint}</Text>
    </View>
  );
}

function Chip({ icon, label, onPress, disabled }: Readonly<{
  icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; disabled?: boolean;
}>) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.chip, disabled && styles.disabled]}
      accessibilityRole="button"
      accessibilityLabel={`Add ${label.toLowerCase()}`}
    >
      <Ionicons name={icon} size={18} color={colors.primary} />
      <Text style={styles.chipText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  label: { color: colors.text, fontSize: 13, fontWeight: "700" },
  optional: { color: colors.subtleText, fontWeight: "500" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  thumb: { width: 44, height: 44, borderRadius: 8 },
  docThumb: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(93, 63, 211, 0.08)" },
  name: { flex: 1, color: colors.text, fontSize: 13 },
  link: { color: colors.primary, textDecorationLine: "underline" },
  chips: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: "rgba(93, 63, 211, 0.40)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 40,
  },
  chipText: { color: colors.primary, fontSize: 13, fontWeight: "700" },
  disabled: { opacity: 0.5 },
  error: { color: colors.danger, fontSize: 12 },
  hint: { color: colors.subtleText, fontSize: 12 },
});
