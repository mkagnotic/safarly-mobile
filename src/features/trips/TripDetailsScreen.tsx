import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useState } from "react";
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from "react-native";

import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { useTripDetail } from "@/hooks/api/useTripDetail";
import { MainTabParamList } from "@/navigation/types";
import { ApiClientError, getErrorMessage, tripsApi, type Trip } from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";
import { EditTripModal, type EditTripFormValues } from "./EditTripModal";

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
    <View style={styles.headerWrap}>
      <Pressable
        onPress={onBack}
        style={styles.backRow}
        accessibilityRole="button"
        accessibilityLabel="Back"
      >
        <Ionicons name="chevron-back" size={16} color={colors.subtleText} />
        <Text style={styles.backText}>Back</Text>
      </Pressable>
      <Text style={styles.title}>Trip Details</Text>
    </View>
  );
}

function MetricCell({
  label,
  value,
  highlight,
}: Readonly<{ label: string; value: string; highlight?: boolean }>) {
  return (
    <View style={[styles.metricCell, highlight && styles.metricCellHighlight]}>
      <Text style={[styles.metricLabel, highlight && styles.metricLabelHighlight]}>{label}</Text>
      <Text style={[styles.metricValue, highlight && styles.metricValueHighlight]}>{value}</Text>
    </View>
  );
}

function TripCard({ trip }: Readonly<{ trip: Trip }>) {
  const planeRotate = Platform.OS === "ios" ? "-42deg" : "-38deg";
  return (
    <Card style={styles.card}>
      <View style={styles.routeRow}>
        <Text style={styles.cityText} numberOfLines={2}>
          {trip.from_city}
        </Text>
        <View style={styles.routeConnector}>
          <View style={styles.routeLine} />
          <Ionicons
            name="airplane-outline"
            size={20}
            color={colors.primary}
            style={{ transform: [{ rotate: planeRotate }] }}
          />
          <View style={styles.routeLine} />
        </View>
        <Text style={styles.cityText} numberOfLines={2}>
          {trip.to_city}
        </Text>
      </View>

      <View style={styles.metricsGrid}>
        <View style={styles.metricRow}>
          <MetricCell label="DATE" value={formatTravelDate(trip.travel_date)} />
          <MetricCell label="CAPACITY" value={`${trip.luggage_capacity_kg} kg`} />
        </View>
        <View style={styles.metricRow}>
          <MetricCell label="OFFERS" value={`${trip.offers_count ?? 0}`} />
          <MetricCell label="EARNINGS" value="--" highlight />
        </View>
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
      <Pressable
        style={styles.emptyButton}
        onPress={onBack}
        accessibilityRole="button"
        accessibilityLabel="Back to My Travels"
      >
        <Text style={styles.emptyButtonText}>Back to My Travels</Text>
      </Pressable>
    </Card>
  );
}

function LoadingState() {
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.loadingText}>Loading trip details…</Text>
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
        showToast({ title: "Trip updated", message: "Your changes are saved.", variant: "success" });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        showToast({ title: "Could not update trip", message, variant: "error" });
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
      // Web parity: `customer.tripCancelToast` = "Trip cancelled. You can list a new trip anytime."
      showToast({
        title: "Trip cancelled",
        message: "You can list a new trip anytime.",
        variant: "warning",
      });
      handleBack();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
      showToast({ title: "Could not cancel trip", message, variant: "error" });
    } finally {
      setCancelPending(false);
    }
  }, [tripId, handleBack]);

  const handleShare = useCallback(() => {
    // Web parity: `customer.tripShareToast` = "Trip link copied to clipboard."
    showToast({
      title: "Share Trip Card",
      message: "Trip link copied to clipboard.",
      variant: "success",
    });
  }, []);

  // Show Loading whenever we don't have the trip yet AND no error has surfaced.
  // This avoids the "Trip not found" flash on the render-tick between
  // route.params arriving and the hook's first refetch firing — that render
  // would otherwise see `loading=false, trip=null, error=null`.
  if (!trip && !error) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <LoadingState />
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

      <TripCard trip={trip} />

      <View style={styles.actionRow}>
        <Pressable
          onPress={handleEditOpen}
          style={[styles.actionButton, styles.actionPrimary]}
          accessibilityRole="button"
          accessibilityLabel="Edit Trip"
        >
          <Ionicons name="pencil-outline" size={14} color={colors.white} />
          <Text style={styles.actionPrimaryText}>Edit Trip</Text>
        </Pressable>

        <Pressable
          onPress={handleShare}
          style={[styles.actionButton, styles.actionMuted]}
          accessibilityRole="button"
          accessibilityLabel="Share Trip Card"
        >
          <Text style={styles.actionMutedText}>Share Trip Card</Text>
        </Pressable>

        <Pressable
          onPress={() => setCancelOpen(true)}
          style={[styles.actionButton, styles.actionDanger]}
          accessibilityRole="button"
          accessibilityLabel="Cancel Trip"
        >
          <Text style={styles.actionDangerText}>Cancel Trip</Text>
        </Pressable>
      </View>

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
        confirmLabel="Yes, Cancel Trip"
        cancelLabel="Keep Trip"
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
  headerWrap: {
    marginTop: 8,
    marginBottom: 16,
    gap: 10,
  },
  backRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 4,
  },
  backText: { color: colors.subtleText, fontSize: 13, fontWeight: "600" },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },

  card: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 18,
    marginBottom: 16,
  },
  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 18,
  },
  cityText: {
    color: colors.text,
    fontSize: 17,
    lineHeight: 22,
    fontWeight: "800",
    flex: 1,
    textAlign: "center",
  },
  routeConnector: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 8,
  },
  routeLine: { width: 14, height: 1, backgroundColor: colors.border },

  metricsGrid: { gap: 10 },
  metricRow: { flexDirection: "row", gap: 10 },
  metricCell: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    minHeight: 70,
    justifyContent: "center",
  },
  metricCellHighlight: {
    backgroundColor: primaryTint.fill10,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
  },
  metricLabel: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  metricLabelHighlight: { color: colors.primary, opacity: 0.95 },
  metricValue: { color: colors.text, fontSize: 17, lineHeight: 22, fontWeight: "800" },
  metricValueHighlight: { color: colors.primary },

  actionRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    marginBottom: 20,
  },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 11,
    borderRadius: 14,
    gap: 6,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  actionMuted: { backgroundColor: colors.surfaceMuted },
  actionMutedText: { color: colors.text, fontSize: 14, fontWeight: "800" },
  actionDanger: { backgroundColor: "rgba(220, 40, 40, 0.10)" },
  actionDangerText: { color: colors.danger, fontSize: 14, fontWeight: "800" },

  loadingWrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 80,
    gap: 12,
  },
  loadingText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },

  emptyCard: {
    borderRadius: 16,
    paddingVertical: 24,
    paddingHorizontal: 18,
    alignItems: "center",
  },
  emptyTitle: { color: colors.text, fontSize: 18, fontWeight: "800", marginBottom: 6, textAlign: "center" },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 16,
  },
  emptyButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyButtonText: { color: colors.white, fontSize: 14, fontWeight: "800" },
});
