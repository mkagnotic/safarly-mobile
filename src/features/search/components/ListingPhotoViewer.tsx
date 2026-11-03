import { useCallback, useEffect, useRef, useState } from "react";
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
  type NativeScrollEvent,
  type NativeSyntheticEvent,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import {
  fileA11yLabel,
  pageForOffset,
  viewerCounter,
  viewerTitle,
  type SharedFiles,
} from "@/features/search/lib/listingPhotos";
import { formatDateLabel } from "@/features/search/lib/searchConfig";
import type { SharedListingFile } from "@/services/api/listingFiles";
import { colors } from "@/theme/colors";

/**
 * Full-screen viewer for ONE search listing's shared files: swipe between them,
 * "2 / 5" counter, close, Report. A PDF opens in the system app (the same
 * `Linking.openURL` the listing files field uses). `data` null = still loading.
 */
export function ListingPhotoViewer({
  open,
  data,
  initialIndex,
  fallbackRoute,
  canReport,
  reportLabel,
  onClose,
  onReport,
  onDismiss,
  title: titleOverride,
  fileLabel,
}: Readonly<{
  open: boolean;
  data: SharedFiles | null;
  initialIndex: number;
  /** Route for the header while `data` is loading. */
  fallbackRoute: { from_city: string; to_city: string };
  canReport: boolean;
  /** "Report trip" / "Report parcel" - the Report button's accessibility label. */
  reportLabel: string;
  onClose: () => void;
  onReport: () => void;
  /** iOS: the Modal finished closing (for `useModalHandoff`). */
  onDismiss?: () => void;
  /** Header text instead of the route (the booking's "Carrier's photos"). */
  title?: string;
  /** Each page's accessibility label instead of "Photo 1 of 3 for <route>". */
  fileLabel?: (index: number, total: number) => string;
}>) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const files = data?.files ?? [];
  const total = files.length;
  const start = Math.min(Math.max(0, initialIndex), Math.max(0, total - 1));
  const [index, setIndex] = useState(start);
  const [broken, setBroken] = useState<ReadonlySet<number>>(() => new Set());
  const listRef = useRef<FlatList<SharedListingFile>>(null);

  useEffect(() => {
    if (open) {
      setIndex(start);
      setBroken(new Set());
    }
  }, [open, start, data]);

  const listing = data?.listing ?? { ...fallbackRoute, date: null };
  const title = titleOverride ?? viewerTitle(listing, formatDateLabel);

  const onMomentumEnd = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      setIndex(pageForOffset(e.nativeEvent.contentOffset.x, width, total));
    },
    [width, total],
  );

  const renderItem = useCallback(
    ({ item, index: i }: ListRenderItemInfo<SharedListingFile>) => {
      const label = fileLabel ? fileLabel(i, total) : fileA11yLabel(item, i, total, listing);
      if (item.kind === "pdf") {
        return (
          <View style={[styles.pageItem, { width }]} accessible accessibilityLabel={label}>
            <View style={styles.docCard}>
              <Ionicons name="document-text-outline" size={48} color={colors.white} />
              <Text style={styles.docName} numberOfLines={3}>
                {item.name}
              </Text>
              <AppButton
                label="Open PDF"
                variant="secondary"
                onPress={() => void Linking.openURL(item.url).catch(() => undefined)}
              />
            </View>
          </View>
        );
      }
      return (
        <View
          style={[styles.pageItem, { width }]}
          accessible
          accessibilityRole="image"
          accessibilityLabel={label}
        >
          {broken.has(i) ? null : (
            <Image
              source={{ uri: item.url }}
              style={styles.image}
              resizeMode="contain"
              onError={() => setBroken((prev) => (prev.has(i) ? prev : new Set(prev).add(i)))}
            />
          )}
        </View>
      );
    },
    [width, total, listing, broken, fileLabel],
  );

  return (
    <Modal
      visible={open}
      animationType="fade"
      onRequestClose={onClose}
      onDismiss={onDismiss}
      statusBarTranslucent
      supportedOrientations={["portrait", "landscape"]}
    >
      <View style={[styles.page, { paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={2} accessibilityRole="header">
            {title}
          </Text>
          <Pressable
            onPress={onClose}
            style={styles.iconBtn}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={24} color={colors.white} />
          </Pressable>
        </View>

        <View style={styles.body}>
          {data && total > 0 ? (
            <FlatList
              ref={listRef}
              key={`${width}-${data.listing?.id ?? ""}`}
              data={files}
              keyExtractor={(f, i) => `${i}-${f.name}`}
              renderItem={renderItem}
              horizontal
              pagingEnabled
              showsHorizontalScrollIndicator={false}
              initialScrollIndex={start}
              getItemLayout={(_, i) => ({ length: width, offset: width * i, index: i })}
              onMomentumScrollEnd={onMomentumEnd}
            />
          ) : (
            <ActivityIndicator size="large" color={colors.white} />
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.counter} accessibilityLiveRegion="polite">
            {total > 0 ? viewerCounter(index, total) : ""}
          </Text>
          {canReport ? (
            <Pressable
              onPress={onReport}
              style={styles.reportBtn}
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={reportLabel}
            >
              <Ionicons name="flag-outline" size={16} color={colors.white} />
              <Text style={styles.reportText}>Report</Text>
            </Pressable>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#000" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  title: { flex: 1, minWidth: 0, color: colors.white, fontSize: 15, lineHeight: 20, fontWeight: "700" },
  iconBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "rgba(255,255,255,0.14)",
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, justifyContent: "center" },
  pageItem: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  image: { width: "100%", height: "100%" },
  docCard: { alignItems: "center", gap: 12, paddingHorizontal: 24, maxWidth: 420 },
  docName: { color: colors.white, fontSize: 14, lineHeight: 20, fontWeight: "600", textAlign: "center" },
  footer: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  counter: { color: colors.white, fontSize: 14, fontWeight: "700" },
  reportBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.14)",
  },
  reportText: { color: colors.white, fontSize: 14, fontWeight: "700" },
});
