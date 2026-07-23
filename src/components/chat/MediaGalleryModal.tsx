import { useCallback, useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Linking,
  Modal,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import {
  getErrorMessage,
  messagesApi,
  type ChatMediaItem,
} from "@/services/api";
import { colors } from "@/theme/colors";

interface MediaGalleryModalProps {
  open: boolean;
  conversationId: string | null;
  onClose: () => void;
}

const isImage = (t: string | null): boolean => !!t && t.startsWith("image/");
const isPdf = (t: string | null): boolean => !!t && t.includes("pdf");
const isVideo = (t: string | null): boolean => !!t && t.startsWith("video/");

/** Short badge for verification media shown among chat attachments. */
const categoryBadge = (c?: string): string | null =>
  c === "travel_document" ? "Travel doc" : c === "parcel_photo" ? "Parcel" : null;

const GRID_GAP = 2;

/**
 * Shared media in a conversation — a full-screen, WhatsApp-style gallery: a tight
 * 3-across grid of square thumbnails, edge to edge. Tapping a photo opens it in a
 * full-screen viewer; documents/videos open in the system app. Backed by
 * `GET /conversations/:id/media` (newest first).
 */
export function MediaGalleryModal({ open, conversationId, onClose }: Readonly<MediaGalleryModalProps>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const [media, setMedia] = useState<ChatMediaItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewerUrl, setViewerUrl] = useState<string | null>(null);

  const tileSize = Math.floor((width - GRID_GAP * 2) / 3);

  const load = useCallback(async () => {
    if (!conversationId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await messagesApi.getMedia(conversationId);
      setMedia(res.data?.media ?? []);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    if (open) void load();
    else {
      setMedia([]);
      setError(null);
      setViewerUrl(null);
    }
  }, [open, load]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<ChatMediaItem>) => {
      const url = item.attachment_url;
      const img = isImage(item.attachment_type);
      const label = isPdf(item.attachment_type)
        ? "PDF"
        : isVideo(item.attachment_type)
          ? "Video"
          : "File";
      const icon: keyof typeof Ionicons.glyphMap = isVideo(item.attachment_type)
        ? "videocam"
        : isPdf(item.attachment_type)
          ? "document-text"
          : "document-attach";
      return (
        <Pressable
          onPress={() => {
            if (img && url) setViewerUrl(url);
            else if (url) void Linking.openURL(url);
          }}
          style={{ width: tileSize, height: tileSize, marginBottom: GRID_GAP }}
          accessibilityRole="button"
          accessibilityLabel={item.attachment_name ?? label}
        >
          {img && url ? (
            <Image source={{ uri: url }} style={styles.tileImg} />
          ) : (
            <View style={styles.tileDoc}>
              <Ionicons name={icon} size={26} color={colors.primary} />
              <Text style={styles.tileDocText} numberOfLines={1}>
                {label}
              </Text>
              {isVideo(item.attachment_type) ? (
                <View style={styles.playBadge}>
                  <Ionicons name="play" size={14} color={colors.white} />
                </View>
              ) : null}
            </View>
          )}
          {categoryBadge(item.category) ? (
            <View style={styles.catBadge}>
              <Text style={styles.catBadgeText} numberOfLines={1}>
                {categoryBadge(item.category)}
              </Text>
            </View>
          ) : null}
        </Pressable>
      );
    },
    [tileSize],
  );

  return (
    <Modal visible={open} animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <Pressable
            onPress={onClose}
            style={styles.headerBtn}
            accessibilityRole="button"
            accessibilityLabel="Back"
          >
            <Ionicons name="arrow-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={styles.headerTitle}>Media</Text>
          {media.length > 0 ? <Text style={styles.headerCount}>{media.length}</Text> : null}
        </View>

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Ionicons name="cloud-offline-outline" size={34} color={colors.mutedText} />
            <Text style={styles.emptyBody}>{error}</Text>
          </View>
        ) : media.length === 0 ? (
          <View style={styles.centered}>
            <Ionicons name="images-outline" size={38} color={colors.mutedText} />
            <Text style={styles.emptyTitle}>No media yet</Text>
            <Text style={styles.emptyBody}>Photos, videos and files you share will show up here.</Text>
          </View>
        ) : (
          <FlatList
            data={media}
            keyExtractor={(m) => m.id}
            renderItem={renderItem}
            numColumns={3}
            columnWrapperStyle={styles.gridRow}
            showsVerticalScrollIndicator={false}
          />
        )}
      </View>

      {/* Full-screen image viewer */}
      {viewerUrl ? (
        <Pressable style={styles.viewer} onPress={() => setViewerUrl(null)}>
          <Image source={{ uri: viewerUrl }} style={styles.viewerImg} resizeMode="contain" />
          <Pressable
            onPress={() => setViewerUrl(null)}
            style={[styles.viewerClose, { top: insets.top + 8 }]}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </Pressable>
      ) : null}
    </Modal>
  );
}

export default MediaGalleryModal;

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.card },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 8,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { flex: 1, color: colors.text, fontSize: 18, fontWeight: "800" },
  headerCount: {
    color: colors.mutedText,
    fontSize: 13,
    fontWeight: "700",
    paddingHorizontal: 12,
  },

  gridRow: { gap: GRID_GAP },
  tileImg: { width: "100%", height: "100%", backgroundColor: colors.surfaceMuted },
  tileDoc: {
    width: "100%",
    height: "100%",
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    paddingHorizontal: 6,
  },
  tileDocText: { color: colors.primary, fontSize: 11, fontWeight: "800" },
  playBadge: {
    position: "absolute",
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
  catBadge: {
    position: "absolute",
    left: 4,
    bottom: 4,
    maxWidth: "90%",
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  catBadgeText: { color: colors.white, fontSize: 10, fontWeight: "800" },

  centered: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  emptyBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", lineHeight: 19 },

  viewer: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.94)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerImg: { width: "100%", height: "100%" },
  viewerClose: {
    position: "absolute",
    right: 16,
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
});
