import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Image, StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { ModerationMenu } from "@/components/moderation/ModerationMenu";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { ListingPhotoViewer } from "@/features/search/components/ListingPhotoViewer";
import { useListingPhotos } from "@/features/search/hooks/useListingPhotos";
import {
  fileA11yLabel,
  listingKindOf,
  moreTileA11yLabel,
  photoCount,
  stripTiles,
  STRIP_MAX_THUMBS,
  type SharedFiles,
} from "@/features/search/lib/listingPhotos";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { colors } from "@/theme/colors";

const TILE = 52;

/**
 * Up to 3 thumbnails of ONE search listing's shared files, then a "+N" tile;
 * tap opens the full-screen viewer for that listing only (2 Nov 2026).
 *
 * DISPLAY ONLY: a listing with no photos never fetches, and a 404 / error /
 * broken image renders nothing - no toast, no error state. Web parity:
 * src/features/search/components/ListingPhotoStrip.tsx.
 */
export function ListingPhotoStrip({
  listing,
  canReport,
  style,
}: Readonly<{
  listing: {
    id: string;
    type: "carrier_trip" | "receive_request";
    from_city: string;
    to_city: string;
    photo_count?: number | null;
  };
  /** Someone else's listing: the viewer offers Report. */
  canReport: boolean;
  /** Spacing for where it sits; applied only when something renders. */
  style?: StyleProp<ViewStyle>;
}>) {
  const count = photoCount(listing);
  if (count === 0) return null;
  return <StripInner listing={listing} count={count} canReport={canReport} style={style} />;
}

function StripInner({
  listing,
  count,
  canReport,
  style,
}: Readonly<{
  listing: { id: string; type: "carrier_trip" | "receive_request"; from_city: string; to_city: string };
  count: number;
  canReport: boolean;
  style?: StyleProp<ViewStyle>;
}>) {
  const kind = listingKindOf(listing.type);
  const { data, ensureFresh, peekFresh } = useListingPhotos(kind, listing.id, count);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [viewerOpen, setViewerOpen] = useState(false);
  const [viewerIndex, setViewerIndex] = useState(0);
  const [viewerData, setViewerData] = useState<SharedFiles | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  // The report sheet is mounted on first use only - not once per search row.
  const [reportMounted, setReportMounted] = useState(false);
  const { after, onDismiss } = useModalHandoff();
  const reportLabel = kind === "trip" ? "Report trip" : "Report parcel";

  const openViewer = useCallback(
    (index: number) => {
      setViewerIndex(index);
      setViewerOpen(true);
      const cached = peekFresh();
      if (cached) {
        setViewerData(cached);
        return;
      }
      // Signed links live 600 s: a viewer opened later refetches first, and
      // shows nothing at all if that fails.
      setViewerData(null);
      void ensureFresh().then((fresh) => {
        if (fresh) setViewerData(fresh);
        else setViewerOpen(false);
      });
    },
    [ensureFresh, peekFresh],
  );

  const closeViewer = useCallback(() => setViewerOpen(false), []);

  if (!data) return null;
  const files = data.files.filter((f) => !broken.has(f.url));
  if (files.length === 0) return null;
  const { shown, extra } = stripTiles(files);
  const total = files.length;

  return (
    <View style={[styles.strip, style]} testID={`listing-photos-${listing.id}`}>
      {shown.map((f, i) => (
        <Pressable
          key={`${i}-${f.name}`}
          onPress={() => openViewer(data.files.indexOf(f))}
          style={styles.tile}
          accessibilityRole="button"
          accessibilityLabel={fileA11yLabel(f, i, total, listing)}
        >
          {f.kind === "pdf" ? (
            <View style={[styles.tileFill, styles.docTile]}>
              <Ionicons name="document-text-outline" size={22} color={colors.primary} />
            </View>
          ) : (
            <Image
              source={{ uri: f.url }}
              style={styles.tileFill}
              onError={() => setBroken((prev) => (prev.has(f.url) ? prev : new Set(prev).add(f.url)))}
            />
          )}
        </Pressable>
      ))}
      {extra > 0 ? (
        <Pressable
          onPress={() => openViewer(data.files.indexOf(files[STRIP_MAX_THUMBS]))}
          style={[styles.tile, styles.moreTile]}
          accessibilityRole="button"
          accessibilityLabel={moreTileA11yLabel(extra, listing)}
        >
          <Text style={styles.moreText} maxFontSizeMultiplier={1.35} numberOfLines={1}>
            +{extra}
          </Text>
        </Pressable>
      ) : null}

      <ListingPhotoViewer
        open={viewerOpen}
        data={viewerData}
        initialIndex={viewerIndex}
        fallbackRoute={listing}
        canReport={canReport}
        reportLabel={reportLabel}
        onClose={closeViewer}
        onDismiss={onDismiss}
        onReport={() =>
          after(closeViewer, () => {
            setReportMounted(true);
            setReportOpen(true);
          })
        }
      />
      {canReport && reportMounted ? (
        <ModerationMenu
          target={{ type: kind, id: listing.id }}
          reportLabel={reportLabel}
          hideTrigger
          reportOpen={reportOpen}
          onReportOpenChange={setReportOpen}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  tile: { width: TILE, height: TILE, borderRadius: 10, overflow: "hidden" },
  tileFill: { width: "100%", height: "100%", backgroundColor: colors.surfaceMuted },
  docTile: { alignItems: "center", justifyContent: "center", backgroundColor: "rgba(93, 63, 211, 0.08)" },
  moreTile: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(93, 63, 211, 0.12)",
  },
  moreText: { color: colors.primary, fontSize: 15, fontWeight: "800" },
});
