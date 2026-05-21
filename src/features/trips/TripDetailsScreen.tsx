import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import { useTripDetail } from "@/hooks/api/useTripDetail";
import { MainTabParamList } from "@/navigation/types";
import { ApiClientError, getErrorMessage, tripsApi, type Trip } from "@/services/api";
import { colors } from "@/theme/colors";
import { EditTripModal, type EditTripFormValues } from "./EditTripModal";

type NoticeVariant = "success" | "error" | "warning" | "info";
interface Notice {
  variant: NoticeVariant;
  title?: string;
  message: string;
}

type Nav = BottomTabNavigationProp<MainTabParamList, "TripDetailsTab">;
type Route = RouteProp<MainTabParamList, "TripDetailsTab">;

function formatTravelDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function DetailsHeader({ onBack }: Readonly<{ onBack: () => void }>) {
  return (
    <View style={styles.headerRow}>
      <Pressable
        onPress={onBack}
        style={styles.backButton}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      </Pressable>
      <Text style={styles.title}>Trip details</Text>
    </View>
  );
}

function TripCard({ trip }: Readonly<{ trip: Trip }>) {
  return (
    <Card style={styles.card}>
      <RouteHeader fromCity={trip.from_city} toCity={trip.to_city} kind="trip" />
      <View style={styles.metricsGrid}>
        <MetricRow>
          <MetricTile label="DATE" value={formatTravelDate(trip.travel_date)} />
          <MetricTile label="CAPACITY" value={`${trip.luggage_capacity_kg} kg`} />
        </MetricRow>
        <MetricRow>
          <MetricTile label="OFFERS" value={`${trip.offers_count ?? 0}`} />
          <MetricTile label="EARNINGS" value="--" highlight />
        </MetricRow>
      </View>
    </Card>
  );
}

function NotFoundCard({
  onBack,
  errorMessage,
}: Readonly<{ onBack: () => void; errorMessage?: string }>) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>We couldn't find that trip.</Text>
      <Text style={styles.emptySubtitle}>
        {errorMessage ?? "This trip may have been cancelled or removed."}
      </Text>
      <AppButton
        label="Back to my travels"
        onPress={onBack}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.emptyButtonWrap}
      />
    </Card>
  );
}

function TripDetailsSkeleton() {
  return (
    <View>
      <Card style={styles.card}>
        <View style={styles.skeletonRouteRow}>
          <SkeletonBlock style={styles.skeletonCity} />
          <View style={styles.skeletonConnector}>
            <View style={styles.skeletonConnectorLine} />
            <SkeletonBlock style={styles.skeletonConnectorIcon} />
            <View style={styles.skeletonConnectorLine} />
          </View>
          <SkeletonBlock style={styles.skeletonCity} />
        </View>
        <View style={styles.metricsGrid}>
          <View style={styles.skeletonMetricRow}>
            <SkeletonBlock style={styles.skeletonTile} />
            <SkeletonBlock style={styles.skeletonTile} />
          </View>
          <View style={styles.skeletonMetricRow}>
            <SkeletonBlock style={styles.skeletonTile} />
            <SkeletonBlock style={styles.skeletonTile} />
          </View>
        </View>
      </Card>
      <SkeletonBlock style={styles.skeletonPrimaryButton} />
      <SkeletonBlock style={styles.skeletonCancelButton} />
    </View>
  );
}

export function TripDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const tripId = route.params?.tripId;

  const { trip, error, refetch } = useTripDetail(tripId);

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Parcels"); // My Travels lives on the "Parcels" tab key
  }, [navigation]);

  const handleEditOpen = useCallback(() => setEditOpen(true), []);
  const handleEditCancel = useCallback(() => {
    if (!editPending) setEditOpen(false);
  }, [editPending]);

  const handleEditSubmit = useCallback(
    async (values: EditTripFormValues) => {
      if (!tripId || !trip) return;
      const data: Parameters<typeof tripsApi.update>[1] = {};
      if (values.travel_date && values.travel_date !== trip.travel_date) {
        data.travel_date = values.travel_date;
      }
      const capacityNum = Number(values.luggage_capacity_kg);
      if (
        values.luggage_capacity_kg !== "" &&
        Number.isFinite(capacityNum) &&
        capacityNum !== trip.luggage_capacity_kg
      ) {
        data.luggage_capacity_kg = capacityNum;
      }
      // `notes` is not in trip-handler's allowedFields (server-side gap) — we
      // still send it for parity; server silently drops unknown fields.
      if (values.notes !== (trip.notes ?? "")) {
        (data as Record<string, unknown>).notes = values.notes;
      }

      if (Object.keys(data).length === 0) {
        setEditOpen(false);
        return;
      }

      setEditPending(true);
      try {
        await tripsApi.update(tripId, data);
        await refetch();
        setEditOpen(false);
        setNotice({ variant: "success", title: "Trip updated", message: "Your changes are saved." });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        setNotice({ variant: "error", title: "Couldn't update trip", message });
      } finally {
        setEditPending(false);
      }
    },
    [tripId, trip, refetch],
  );

  const handleCancelTrip = useCallback(async () => {
    if (!tripId) return;
    setCancelPending(true);
    try {
      await tripsApi.delete(tripId);
      setCancelOpen(false);
      handleBack();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
      setNotice({ variant: "error", title: "Couldn't cancel trip", message });
    } finally {
      setCancelPending(false);
    }
  }, [tripId, handleBack]);

  // Avoids a "Trip not found" flash between route.params arriving and the
  // hook's first refetch firing.
  if (!trip && !error) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <TripDetailsSkeleton />
      </Screen>
    );
  }

  if (error || !trip) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <NotFoundCard
          onBack={handleBack}
          errorMessage={error ? getErrorMessage(error) : undefined}
        />
      </Screen>
    );
  }

  const editInitial: EditTripFormValues = {
    travel_date: trip.travel_date ?? "",
    luggage_capacity_kg: `${trip.luggage_capacity_kg ?? ""}`,
    notes: trip.notes ?? "",
  };

  return (
    <Screen onRefresh={refetch}>
      <DetailsHeader onBack={handleBack} />

      {notice ? (
        <View style={styles.bannerSlot}>
          <FormBanner
            variant={notice.variant}
            title={notice.title}
            message={notice.message}
            onDismiss={() => setNotice(null)}
          />
        </View>
      ) : null}

      <TripCard trip={trip} />

      <AppButton
        label="Edit trip"
        onPress={handleEditOpen}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.primaryActionButton}
      />

      <Pressable
        onPress={() => setCancelOpen(true)}
        style={styles.cancelButton}
        accessibilityRole="button"
        accessibilityLabel="Cancel trip"
      >
        <Text style={styles.cancelButtonText}>Cancel trip</Text>
      </Pressable>

      <EditTripModal
        open={editOpen}
        initial={editInitial}
        pending={editPending}
        onCancel={handleEditCancel}
        onSubmit={handleEditSubmit}
      />

      <ConfirmActionModal
        open={cancelOpen}
        title="Cancel this trip?"
        body="This action cannot be undone. All pending offers will be rejected."
        confirmLabel="Yes, cancel trip"
        cancelLabel="Keep trip"
        tone="destructive"
        icon="alert-circle"
        pending={cancelPending}
        onCancel={() => {
          if (!cancelPending) setCancelOpen(false);
        }}
        onConfirm={handleCancelTrip}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 34,
    marginTop: 16,
    marginBottom: 18,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  bannerSlot: { marginBottom: 14 },

  card: { padding: 16, marginBottom: 18, gap: 14 },
  metricsGrid: { gap: 10 },

  primaryActionButton: { alignSelf: "stretch", marginBottom: 12 },

  cancelButton: {
    minHeight: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(220, 40, 40, 0.32)",
    backgroundColor: "rgba(220, 40, 40, 0.06)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  cancelButtonText: { color: colors.danger, fontSize: 15, lineHeight: 20, fontWeight: "700" },

  skeletonRouteRow: { flexDirection: "row", alignItems: "center" },
  skeletonCity: { flex: 1, height: 22, marginHorizontal: 4 },
  skeletonConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  skeletonConnectorLine: { width: 14, height: 1, backgroundColor: colors.border },
  skeletonConnectorIcon: { width: 20, height: 20, borderRadius: 10 },
  skeletonMetricRow: { flexDirection: "row", gap: 10 },
  skeletonTile: { flex: 1, height: 70, borderRadius: 14 },
  skeletonPrimaryButton: { height: 48, borderRadius: 16, marginBottom: 12 },
  skeletonCancelButton: { height: 46, borderRadius: 12, marginBottom: 20 },

  emptyCard: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: colors.text,
    fontSize: 18,
    lineHeight: 24,
    fontWeight: "800",
    marginBottom: 6,
    textAlign: "center",
  },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButtonWrap: { alignSelf: "stretch", maxWidth: 240 },
});
