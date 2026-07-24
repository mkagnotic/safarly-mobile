import { memo, useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type ListRenderItemInfo,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { ListSkeleton } from "@/components/ui/Skeletons";
import { useParcels } from "@/hooks/api/useParcels";
import { MainTabParamList } from "@/navigation/types";
import { getErrorMessage, type Parcel } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { shadowFab, shadowSoft } from "@/theme/elevation";

type Nav = BottomTabNavigationProp<MainTabParamList, "Parcels">;

/**
 * Filter chips mirror web's CustomerParcels exactly:
 *   filters = ["All", "Open", "In Transit", "Delivered", "Disputed"]
 *   filterMap = { 0: undefined, 1: "open", 2: "in_transit", 3: "delivered", 4: "disputed" }
 */
type FilterStatus = "open" | "in_transit" | "delivered" | "disputed" | undefined;
const FILTER_CHIPS: ReadonlyArray<{ label: string; status: FilterStatus }> = [
  { label: "All", status: undefined },
  { label: "Open", status: "open" },
  { label: "In Transit", status: "in_transit" },
  { label: "Delivered", status: "delivered" },
  { label: "Disputed", status: "disputed" },
] as const;

interface StatusBadgeStyle {
  bg: string;
  fg: string;
  label: string;
}

/** Mirrors web's `statusColors` palette intent + uses our theme tokens. */
function styleForStatus(status: string): StatusBadgeStyle {
  switch (status) {
    case "open":
      return { bg: primaryTint.fill10, fg: colors.primary, label: "OPEN" };
    case "in_transit":
      return { bg: "rgba(245, 158, 11, 0.12)", fg: colors.warning, label: "IN TRANSIT" };
    case "delivered":
      return { bg: "rgba(34, 197, 94, 0.10)", fg: colors.safe, label: "DELIVERED" };
    case "disputed":
      return { bg: "rgba(239, 68, 68, 0.10)", fg: colors.danger, label: "DISPUTED" };
    default:
      return { bg: colors.surfaceMuted, fg: colors.mutedText, label: status.replace("_", " ").toUpperCase() };
  }
}

/** "Mar 18" — same shape as web's `toLocaleDateString({month, day})`. */
function formatDeliveryBy(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function senderInitial(name: string | undefined | null): string {
  if (!name) return "?";
  return name.trim().charAt(0).toUpperCase() || "?";
}

export function ParcelsScreen() {
  const navigation = useNavigation<Nav>();

  const [filterIndex, setFilterIndex] = useState(0);
  const [query, setQuery] = useState("");

  const status = FILTER_CHIPS[filterIndex]?.status;

  // Web passes `filter: 'my_parcels'` to scope to the user's parcels.
  const { parcels, loading, error, refetch } = useParcels({
    filter: "my_parcels",
    status,
    perPage: 20,
  });

  // Web does client-side search on top of the server-filtered list.
  const visibleParcels = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parcels;
    return parcels.filter(
      (p) =>
        p.from_city?.toLowerCase().includes(q) ||
        p.to_city?.toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [parcels, query]);

  const handleFilterChange = useCallback((index: number) => {
    setFilterIndex(index);
  }, []);

  const handleOpenParcel = useCallback(
    (parcelId: string) => {
      navigation.navigate("ParcelDetailsTab", { parcelId });
    },
    [navigation],
  );

  const handleSendParcel = useCallback(
    () => navigation.navigate("SendParcelTab"),
    [navigation],
  );

  const listHeader = useMemo(
    () => (
      <ParcelsListHeader
        query={query}
        onQueryChange={setQuery}
        filterIndex={filterIndex}
        onFilterChange={handleFilterChange}
        onSendParcel={handleSendParcel}
      />
    ),
    [query, filterIndex, handleFilterChange, handleSendParcel],
  );

  const listEmpty = useMemo(() => {
    if (loading) {
      return <ListSkeleton />;
    }
    if (error) {
      return (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={48} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Couldn't load parcels</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
            accessibilityLabel="Retry"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      );
    }
    if (parcels.length === 0) {
      // No data at all — show the rich empty state with CTA.
      return (
        <View style={styles.emptyFull}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cube-outline" size={40} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No parcels found</Text>
          <Text style={styles.emptySubtitle}>
            {filterIndex > 0
              ? "Try a different filter."
              : "Send your first parcel to get started!"}
          </Text>
          <Pressable
            style={styles.emptyCta}
            onPress={handleSendParcel}
            accessibilityRole="button"
            accessibilityLabel="Send a parcel"
          >
            <Text style={styles.emptyCtaText}>Send Parcel</Text>
          </Pressable>
        </View>
      );
    }
    // Has data but search query filtered everything out.
    return (
      <View style={styles.emptyFilter}>
        <Text style={styles.emptyFilterTitle}>No matching parcels</Text>
        <Text style={styles.emptyFilterSubtitle}>Try a different search term.</Text>
      </View>
    );
  }, [loading, error, parcels.length, filterIndex, handleSendParcel, refetch]);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Parcel>) => (
      <ParcelRow parcel={item} onPress={handleOpenParcel} />
    ),
    [handleOpenParcel],
  );

  const keyExtractor = useCallback((item: Parcel) => item.id, []);

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        <FlatList
          data={visibleParcels}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListHeaderComponent={listHeader}
          ListEmptyComponent={listEmpty}
          contentContainerStyle={[
            styles.listContent,
            visibleParcels.length === 0 && styles.listContentEmpty,
          ]}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            <RefreshControl
              refreshing={loading && parcels.length > 0}
              onRefresh={refetch}
              tintColor={colors.primary}
            />
          }
          windowSize={7}
          initialNumToRender={8}
          maxToRenderPerBatch={8}
        />
      </View>
    </Screen>
  );
}

// ───────────────────────── Header (search + chips + FAB) ─────────────────────────

interface ParcelsListHeaderProps {
  query: string;
  onQueryChange: (q: string) => void;
  filterIndex: number;
  onFilterChange: (index: number) => void;
  onSendParcel: () => void;
}

const ParcelsListHeader = memo(function ParcelsListHeader({
  query,
  onQueryChange,
  filterIndex,
  onFilterChange,
  onSendParcel,
}: Readonly<ParcelsListHeaderProps>) {
  return (
    <>
      <View style={styles.headerRow}>
        <View style={styles.titleBlock}>
          <Text style={styles.screenTitle}>My Parcels</Text>
          <Text style={styles.screenSubtitle}>Track and manage your delivery requests</Text>
        </View>
        <Pressable
          style={[styles.fab, shadowFab()]}
          onPress={onSendParcel}
          accessibilityRole="button"
          accessibilityLabel="Send a parcel"
        >
          <Ionicons name="add" size={26} color={colors.white} />
        </Pressable>
      </View>

      <View style={[styles.searchRow, shadowSoft()]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedText} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by city, parcel ID..."
          placeholderTextColor={colors.mutedText}
          value={query}
          onChangeText={onQueryChange}
          autoCorrect={false}
          autoCapitalize="none"
        />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chipsContent}
        style={styles.chipsScroll}
      >
        {FILTER_CHIPS.map((chip, index) => {
          const active = filterIndex === index;
          return (
            <Pressable
              key={chip.label}
              onPress={() => onFilterChange(index)}
              style={[styles.chip, active ? styles.chipActive : styles.chipInactive]}
              accessibilityRole="button"
              accessibilityLabel={`Filter: ${chip.label}`}
              accessibilityState={{ selected: active }}
            >
              <Text style={[styles.chipText, active ? styles.chipTextActive : styles.chipTextInactive]}>
                {chip.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </>
  );
});

// ───────────────────────── Row ─────────────────────────

interface ParcelRowProps {
  parcel: Parcel;
  onPress: (parcelId: string) => void;
}

const ParcelRow = memo(function ParcelRow({ parcel, onPress }: Readonly<ParcelRowProps>) {
  const status = styleForStatus(parcel.status);
  const senderName = parcel.sender?.name ?? null;

  return (
    <Pressable
      onPress={() => onPress(parcel.id)}
      accessibilityRole="button"
      accessibilityLabel={`Open parcel ${parcel.id}`}
    >
      <Card style={styles.parcelCard}>
        <View style={styles.cardTop}>
          <Text style={styles.parcelId} numberOfLines={1}>
            {parcel.id.slice(0, 8).toUpperCase()}
          </Text>
          <View style={[styles.badge, { backgroundColor: status.bg }]}>
            <Text style={[styles.badgeText, { color: status.fg }]}>{status.label}</Text>
          </View>
        </View>

        <View style={styles.routeRow}>
          <Ionicons name="location-outline" size={16} color={colors.danger} style={styles.routePin} />
          <View style={styles.routeContent}>
            <Text style={styles.routeText} numberOfLines={2}>
              {parcel.from_city}
            </Text>
            <Ionicons name="arrow-forward" size={15} color={colors.mutedText} style={styles.routeArrowIcon} />
            <Text style={styles.routeText} numberOfLines={2}>
              {parcel.to_city}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="scale" size={14} color={colors.mutedText} />
            <Text style={styles.metaText}>{parcel.weight_kg} kg</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={14} color={colors.mutedText} />
            <Text style={styles.metaText}>{formatDeliveryBy(parcel.delivery_by)}</Text>
          </View>
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={14} color={colors.mutedText} />
            <Text style={styles.metaText}>{parcel.category}</Text>
          </View>
          <Text style={styles.price}>
            {parcel.fee_currency === "USD" ? "$" : ""}
            {parcel.fee_offered}
            {parcel.fee_currency !== "USD" ? ` ${parcel.fee_currency}` : ""}
          </Text>
        </View>

        {senderName ? (
          <>
            <View style={styles.divider} />
            <View style={styles.senderRow}>
              <View style={styles.avatar}>
                <Text style={styles.avatarLabel}>{senderInitial(senderName)}</Text>
              </View>
              <Text style={styles.senderText}>
                Sender: <Text style={styles.senderName}>{senderName}</Text>
              </Text>
            </View>
          </>
        ) : null}
      </Card>
    </Pressable>
  );
});

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: 20 },
  listContent: { paddingBottom: 24 },
  listContentEmpty: { flexGrow: 1 },

  // Header
  headerRow: {
    marginTop: 16,
    marginBottom: 12,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
  },
  titleBlock: { flex: 1 },
  screenTitle: { color: colors.text, fontSize: 22, fontWeight: "800" },
  screenSubtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2, fontWeight: "500" },
  fab: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    gap: 10,
  },
  searchInput: { flex: 1, fontSize: 15, color: colors.text, padding: 0, fontWeight: "500" },

  // Chips
  chipsScroll: { marginBottom: 16, marginHorizontal: -4 },
  chipsContent: { flexDirection: "row", alignItems: "center", paddingHorizontal: 4, gap: 8 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999 },
  chipActive: { backgroundColor: colors.primary },
  chipInactive: { backgroundColor: colors.accent },
  chipText: { fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },
  chipTextInactive: { color: colors.text },

  // Loading / error / empty
  centered: { flex: 1, alignItems: "center", justifyContent: "center", paddingTop: 80, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 14, fontWeight: "500" },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, textAlign: "center", maxWidth: 280 },
  retryButton: {
    marginTop: 8,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: colors.primary,
  },
  retryButtonText: { color: colors.white, fontSize: 14, fontWeight: "700" },
  emptyFull: { flex: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: 8, paddingBottom: 36 },
  emptyIconBox: {
    width: 88,
    height: 88,
    borderRadius: 22,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  emptyTitle: { color: colors.text, fontSize: 20, fontWeight: "800", marginBottom: 8, textAlign: "center" },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    textAlign: "center",
    maxWidth: 300,
    marginBottom: 24,
    fontWeight: "500",
  },
  emptyCta: {
    backgroundColor: colors.primary,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 24,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyCtaText: { color: colors.white, fontSize: 16, fontWeight: "800" },
  emptyFilter: { alignItems: "center", paddingVertical: 40, paddingHorizontal: 16 },
  emptyFilterTitle: { color: colors.text, fontSize: 17, fontWeight: "700", marginBottom: 6 },
  emptyFilterSubtitle: { color: colors.mutedText, fontSize: 14, textAlign: "center" },

  // Card
  parcelCard: { marginBottom: 14, padding: 16, borderRadius: 18 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  parcelId: {
    color: colors.mutedText,
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
    flex: 1,
    paddingRight: 8,
  },
  badge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 },
  badgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.4 },

  routeRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  routeContent: { flexDirection: "row", alignItems: "center", flex: 1 },
  routePin: { marginRight: 6 },
  routeText: { color: colors.text, fontSize: 16, fontWeight: "800", lineHeight: 22, flexShrink: 1 },
  routeArrowIcon: { marginHorizontal: 7 },

  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginBottom: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  price: {
    marginLeft: "auto",
    color: colors.primary,
    fontSize: 16,
    fontWeight: "800",
  },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginBottom: 12 },
  senderRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLabel: { color: colors.text, fontWeight: "700", fontSize: 12 },
  senderText: { color: colors.mutedText, fontSize: 12, fontWeight: "500" },
  senderName: { color: colors.text, fontWeight: "700" },
});
