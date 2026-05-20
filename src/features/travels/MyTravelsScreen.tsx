import { memo, useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { BuddyPartnerCard } from "@/features/travels/BuddyPartnerCard";
import { TravelCard } from "@/features/travels/TravelCard";
import { useBuddyListings } from "@/hooks/api/useBuddyListings";
import { useParcels } from "@/hooks/api/useParcels";
import { useTrips } from "@/hooks/api/useTrips";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  buddiesApi,
  getErrorMessage,
  parcelsApi,
  tripsApi,
  type Parcel,
  type Trip,
} from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

type TabKey = "flights" | "packages" | "partners" | "archive";

interface TabConfig {
  key: TabKey;
  label: string;
  count?: number;
}

export function MyTravelsScreen() {
  const navigation = useNavigation<Nav>();
  const [activeTab, setActiveTab] = useState<TabKey>("flights");

  // Each tab gets its own list hook so loading/error/refetch are independent.
  const flights = useTrips({ filter: "my_trips" });
  const sendParcels = useParcels({ filter: "my_delivering" });
  const receiveParcels = useParcels({ filter: "my_parcels" });
  const partners = useBuddyListings({ filter: "my_listings" });
  const archive = useTrips({ filter: "my_archived" });

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const tabs: readonly TabConfig[] = [
    { key: "flights", label: "Flights", count: flights.total },
    {
      key: "packages",
      label: "Packages",
      count: sendParcels.total + receiveParcels.total,
    },
    { key: "partners", label: "Partners", count: partners.total },
    { key: "archive", label: "Archive", count: archive.total },
  ];

  const goSendParcel = useCallback(
    () => navigation.navigate("SendParcelTab"),
    [navigation],
  );
  const goListTrip = useCallback(
    () => navigation.navigate("ListTripTab"),
    [navigation],
  );

  const refetchActive = useCallback(async () => {
    if (activeTab === "flights") return flights.refetch();
    if (activeTab === "packages") {
      await Promise.all([sendParcels.refetch(), receiveParcels.refetch()]);
      return;
    }
    if (activeTab === "partners") return partners.refetch();
    if (activeTab === "archive") return archive.refetch();
  }, [activeTab, flights, sendParcels, receiveParcels, partners, archive]);

  const withDeleteFlow = useCallback(
    async (
      id: string,
      mutate: (id: string) => Promise<unknown>,
      after: () => void,
    ) => {
      setDeletingId(id);
      setFormError(null);
      try {
        await mutate(id);
        after();
      } catch (err) {
        setFormError(`Couldn't remove. ${getErrorMessage(err)}`);
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const handleDeleteTrip = useCallback(
    (trip: Trip) =>
      withDeleteFlow(trip.id, (id) => tripsApi.delete(id), flights.refetch),
    [withDeleteFlow, flights.refetch],
  );

  const handleDeleteSendParcel = useCallback(
    (parcel: Parcel) =>
      withDeleteFlow(parcel.id, (id) => parcelsApi.delete(id), sendParcels.refetch),
    [withDeleteFlow, sendParcels.refetch],
  );

  const handleDeleteReceiveParcel = useCallback(
    (parcel: Parcel) =>
      withDeleteFlow(
        parcel.id,
        (id) => parcelsApi.delete(id),
        receiveParcels.refetch,
      ),
    [withDeleteFlow, receiveParcels.refetch],
  );

  const handleDeleteBuddy = useCallback(
    (id: string) =>
      withDeleteFlow(id, (lid) => buddiesApi.deleteListing(lid), partners.refetch),
    [withDeleteFlow, partners.refetch],
  );

  const handleOpenTrip = useCallback(
    (id: string) => navigation.navigate("TripDetailsTab", { tripId: id }),
    [navigation],
  );
  const handleOpenParcel = useCallback(
    (id: string) => navigation.navigate("ParcelDetailsTab", { parcelId: id }),
    [navigation],
  );

  const refreshing =
    (activeTab === "flights" && flights.loading && flights.trips.length > 0) ||
    (activeTab === "packages" &&
      ((sendParcels.loading && sendParcels.parcels.length > 0) ||
        (receiveParcels.loading && receiveParcels.parcels.length > 0))) ||
    (activeTab === "partners" && partners.loading && partners.listings.length > 0) ||
    (activeTab === "archive" && archive.loading && archive.trips.length > 0);

  return (
    <Screen scroll={false}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={refetchActive}
            tintColor={colors.wordmark}
          />
        }
      >
        <View style={styles.headerRow}>
          <View style={styles.titleBlock}>
            <Text style={styles.title}>My travels</Text>
            <Text style={styles.subtitle}>
              Track all your flights, packages, and travel partners.
            </Text>
          </View>
        </View>

        {formError ? (
          <View style={styles.bannerSlot}>
            <FormBanner message={formError} onDismiss={() => setFormError(null)} />
          </View>
        ) : null}

        {/* Action row — standard AppButton recipe (radius 16, 14/16 padding,
            15/700 label, scale-on-press). Send is the primary (orange CTA);
            List is the secondary (white card + border) — matches every other
            primary/secondary button pair across the app. */}
        <View style={styles.actionsRow}>
          <AppButton
            label="List trip"
            variant="secondary"
            onPress={goListTrip}
            style={styles.actionButtonFlex}
          />
          <AppButton
            label="Send parcel"
            onPress={goSendParcel}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.actionButtonFlex}
          />
        </View>

        <Tabs tabs={tabs} active={activeTab} onChange={setActiveTab} />

        {activeTab === "flights" ? (
          <FlightsTab
            loading={flights.loading}
            error={flights.error}
            trips={flights.trips}
            onRetry={flights.refetch}
            onOpen={handleOpenTrip}
            onDelete={handleDeleteTrip}
            deletingId={deletingId}
            onListTrip={goListTrip}
          />
        ) : null}

        {activeTab === "packages" ? (
          <PackagesTab
            sendLoading={sendParcels.loading}
            sendParcels={sendParcels.parcels}
            sendError={sendParcels.error}
            receiveLoading={receiveParcels.loading}
            receiveParcels={receiveParcels.parcels}
            receiveError={receiveParcels.error}
            onOpen={handleOpenParcel}
            onDeleteSend={handleDeleteSendParcel}
            onDeleteReceive={handleDeleteReceiveParcel}
            deletingId={deletingId}
            onSendParcel={goSendParcel}
            onRetrySend={sendParcels.refetch}
            onRetryReceive={receiveParcels.refetch}
          />
        ) : null}

        {activeTab === "partners" ? (
          <PartnersTab
            loading={partners.loading}
            error={partners.error}
            listings={partners.listings}
            onRetry={partners.refetch}
            onDelete={handleDeleteBuddy}
            deletingId={deletingId}
          />
        ) : null}

        {activeTab === "archive" ? (
          <ArchiveTab
            loading={archive.loading}
            error={archive.error}
            trips={archive.trips}
            onRetry={archive.refetch}
            onOpen={handleOpenTrip}
          />
        ) : null}
      </ScrollView>
    </Screen>
  );
}

// ───────────────────────── Tabs control ─────────────────────────

interface TabsProps {
  tabs: readonly TabConfig[];
  active: TabKey;
  onChange: (key: TabKey) => void;
}

const Tabs = memo(function Tabs({ tabs, active, onChange }: Readonly<TabsProps>) {
  return (
    <View style={styles.tabsRow}>
      {tabs.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            onPress={() => onChange(tab.key)}
            style={[styles.tab, isActive && styles.tabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: isActive }}
          >
            <Text style={[styles.tabText, isActive && styles.tabTextActive]} numberOfLines={1}>
              {tab.label} {typeof tab.count === "number" ? `(${tab.count})` : ""}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
});

// ───────────────────────── Tab bodies ─────────────────────────

function FlightsTab({
  loading,
  error,
  trips,
  onRetry,
  onOpen,
  onDelete,
  deletingId,
  onListTrip,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  onDelete: (trip: Trip) => void;
  deletingId: string | null;
  onListTrip: () => void;
}>) {
  if (loading && trips.length === 0) return <CenteredSpinner />;
  if (error && trips.length === 0)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (trips.length === 0)
    return (
      <EmptyBlock
        icon="airplane-outline"
        title="No flights listed"
        subtitle="List a trip to start receiving parcel delivery offers."
        actionLabel="List a Trip"
        onAction={onListTrip}
      />
    );
  return (
    <View>
      {trips.map((t) => (
        <TravelCard
          key={t.id}
          type="flight"
          item={t}
          onPress={() => onOpen(t.id)}
          onEdit={() => onOpen(t.id)}
          onDelete={() => onDelete(t)}
          isDeleting={deletingId === t.id}
        />
      ))}
    </View>
  );
}

function PackagesTab({
  sendLoading,
  sendParcels,
  sendError,
  receiveLoading,
  receiveParcels,
  receiveError,
  onOpen,
  onDeleteSend,
  onDeleteReceive,
  deletingId,
  onSendParcel,
  onRetrySend,
  onRetryReceive,
}: Readonly<{
  sendLoading: boolean;
  sendParcels: Parcel[];
  sendError: Error | null;
  receiveLoading: boolean;
  receiveParcels: Parcel[];
  receiveError: Error | null;
  onOpen: (id: string) => void;
  onDeleteSend: (parcel: Parcel) => void;
  onDeleteReceive: (parcel: Parcel) => void;
  deletingId: string | null;
  onSendParcel: () => void;
  onRetrySend: () => Promise<void>;
  onRetryReceive: () => Promise<void>;
}>) {
  return (
    <View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.wordmark} />
          <Text style={styles.sectionTitle}>Send</Text>
          <Text style={styles.sectionHint}>(Packages I'm Delivering)</Text>
        </View>
        {sendLoading && sendParcels.length === 0 ? (
          <CenteredSpinner small />
        ) : sendError && sendParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(sendError)} onRetry={onRetrySend} />
        ) : sendParcels.length === 0 ? (
          <View style={styles.dashedEmpty}>
            <Text style={styles.dashedEmptyText}>No packages to deliver yet</Text>
          </View>
        ) : (
          sendParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onOpen(p.id)}
              onDelete={() => onDeleteSend(p)}
              isDeleting={deletingId === p.id}
            />
          ))
        )}
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.safe} />
          <Text style={styles.sectionTitle}>Receive</Text>
          <Text style={styles.sectionHint}>(Packages I'm Receiving)</Text>
        </View>
        {receiveLoading && receiveParcels.length === 0 ? (
          <CenteredSpinner small />
        ) : receiveError && receiveParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(receiveError)} onRetry={onRetryReceive} />
        ) : receiveParcels.length === 0 ? (
          <EmptyBlock
            icon="cube-outline"
            title="No receive requests"
            subtitle="Send a parcel request to find a carrier."
            actionLabel="Send Parcel"
            onAction={onSendParcel}
            compact
          />
        ) : (
          receiveParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onOpen(p.id)}
              onDelete={() => onDeleteReceive(p)}
              isDeleting={deletingId === p.id}
            />
          ))
        )}
      </View>
    </View>
  );
}

function PartnersTab({
  loading,
  error,
  listings,
  onRetry,
  onDelete,
  deletingId,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  listings: ReturnType<typeof useBuddyListings>["listings"];
  onRetry: () => Promise<void>;
  onDelete: (id: string) => void;
  deletingId: string | null;
}>) {
  if (loading && listings.length === 0) return <CenteredSpinner />;
  if (error && listings.length === 0)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (listings.length === 0)
    return (
      <EmptyBlock
        icon="people-outline"
        title="No travel partners"
        subtitle="Create a buddy listing to find travel companions."
      />
    );
  return (
    <View>
      {listings.map((b) => (
        <BuddyPartnerCard
          key={b.id}
          item={b}
          onDelete={() => onDelete(b.id)}
          isDeleting={deletingId === b.id}
        />
      ))}
    </View>
  );
}

function ArchiveTab({
  loading,
  error,
  trips,
  onRetry,
  onOpen,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
}>) {
  if (loading && trips.length === 0) return <CenteredSpinner />;
  if (error && trips.length === 0)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (trips.length === 0)
    return (
      <EmptyBlock
        icon="archive"
        title="No archived items"
        subtitle="Completed, cancelled, or expired items will appear here."
      />
    );
  return (
    <View>
      {trips.map((t) => (
        <TravelCard key={t.id} type="flight" item={t} onPress={() => onOpen(t.id)} />
      ))}
    </View>
  );
}

// ───────────────────────── Reusable bits ─────────────────────────

function CenteredSpinner({ small }: Readonly<{ small?: boolean }>) {
  return (
    <View style={[styles.centered, small && styles.centeredSmall]}>
      <ActivityIndicator size={small ? "small" : "large"} color={colors.wordmark} />
    </View>
  );
}

function ErrorBlock({
  message,
  onRetry,
}: Readonly<{ message: string; onRetry: () => Promise<void> }>) {
  return (
    <View style={styles.centered}>
      <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
      <Text style={styles.errorTitle}>Couldn't load this list</Text>
      <Text style={styles.errorBody}>{message}</Text>
      <AppButton
        label="Try again"
        onPress={() => void onRetry()}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.retryButtonWrap}
      />
    </View>
  );
}

interface EmptyBlockProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
  compact?: boolean;
}

function EmptyBlock({
  icon,
  title,
  subtitle,
  actionLabel,
  onAction,
  compact,
}: Readonly<EmptyBlockProps>) {
  return (
    <View style={[styles.emptyWrap, compact && styles.emptyCompact]}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={compact ? 22 : 28} color={colors.wordmark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
      {actionLabel && onAction ? (
        <AppButton
          label={actionLabel}
          onPress={onAction}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.emptyCtaWrap}
        />
      ) : null}
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  headerRow: { flexDirection: "row", alignItems: "flex-start", marginTop: 8, marginBottom: 12 },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginTop: 4 },
  bannerSlot: { marginBottom: 14 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 18 },
  actionButtonFlex: { flex: 1 },

  tabsRow: {
    flexDirection: "row",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 6,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "700" },
  tabTextActive: { color: colors.text },

  // Sections within Packages
  section: { marginBottom: 18 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  sectionHint: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  dashedEmpty: {
    paddingVertical: 24,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderStyle: "dashed",
    borderColor: colors.border,
    alignItems: "center",
  },
  dashedEmptyText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500" },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  centeredSmall: { paddingVertical: 24 },
  errorTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500", textAlign: "center", maxWidth: 280 },
  retryButtonWrap: { marginTop: 4, alignSelf: "stretch", maxWidth: 220 },
  emptyWrap: { alignItems: "center", paddingVertical: 32, gap: 8 },
  emptyCompact: { paddingVertical: 20 },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
  },
  emptyTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800", marginTop: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 19,
    fontWeight: "500",
    textAlign: "center",
    maxWidth: 300,
    marginTop: 2,
  },
  emptyCtaWrap: { marginTop: 12, alignSelf: "stretch", maxWidth: 240 },
});
