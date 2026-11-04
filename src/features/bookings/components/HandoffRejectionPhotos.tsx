import { useMemo, useState } from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import {
  CARRIERS_PHOTOS_TITLE,
  rejectionPhotoA11yLabel,
  rejectionPhotoUrls,
} from "@/features/bookings/lib/handoffPhotos";
import { ListingPhotoViewer } from "@/features/search/components/ListingPhotoViewer";
import type { SharedFiles } from "@/features/search/lib/listingPhotos";
import type { Booking } from "@/services/api";
import { colors } from "@/theme/colors";

const TILE = 56;

/**
 * "Carrier's photos": what the carrier attached when they declined the parcel at
 * inspection, shown to BOTH parties on the booking (the receiver never saw them
 * before, 3 Nov 2026). Tap a thumbnail for the full-screen viewer the search
 * listing photos use. DISPLAY ONLY - a broken link just drops its tile.
 */
export function HandoffRejectionPhotos({ booking }: Readonly<{ booking: Booking }>) {
  const urls = rejectionPhotoUrls(booking);
  const [broken, setBroken] = useState<ReadonlySet<string>>(() => new Set());
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const shown = urls.filter((u) => !broken.has(u));
  // Keyed on the URLs, not the array: the viewer resets its page whenever
  // `data` changes identity, and the booking re-renders on every refetch.
  const shownKey = shown.join("|");
  const fromCity = booking.parcel?.from_city ?? "";
  const toCity = booking.parcel?.to_city ?? "";
  const viewerData = useMemo<SharedFiles>(
    () => ({
      files: (shownKey ? shownKey.split("|") : []).map((url, i) => ({
        url,
        name: `photo-${i + 1}`,
        kind: "image" as const,
      })),
      listing: { id: booking.id, from_city: fromCity, to_city: toCity, date: null },
    }),
    [shownKey, booking.id, fromCity, toCity],
  );

  if (shown.length === 0) return null;
  const total = shown.length;

  return (
    <View style={styles.wrap} testID="handoff-rejection-photos">
      <Text style={styles.title} accessibilityRole="header">
        {CARRIERS_PHOTOS_TITLE}
      </Text>
      <View style={styles.row}>
        {shown.map((url, i) => (
          <Pressable
            key={url}
            onPress={() => setViewerIndex(i)}
            style={styles.tile}
            accessibilityRole="button"
            accessibilityLabel={rejectionPhotoA11yLabel(i, total)}
          >
            <Image
              source={{ uri: url }}
              style={styles.tileFill}
              onError={() => setBroken((prev) => (prev.has(url) ? prev : new Set(prev).add(url)))}
            />
          </Pressable>
        ))}
      </View>
      <ListingPhotoViewer
        open={viewerIndex !== null}
        data={viewerData}
        initialIndex={viewerIndex ?? 0}
        fallbackRoute={viewerData.listing}
        canReport={false}
        reportLabel=""
        title={CARRIERS_PHOTOS_TITLE}
        fileLabel={rejectionPhotoA11yLabel}
        onClose={() => setViewerIndex(null)}
        onReport={() => undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  title: { color: colors.text, fontSize: 13, fontWeight: "800", flexShrink: 1 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  tile: { width: TILE, height: TILE, borderRadius: 10, overflow: "hidden" },
  tileFill: { width: "100%", height: "100%", backgroundColor: colors.surfaceMuted },
});
