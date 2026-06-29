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
import { ANY_CITY } from "@/features/search/CityPicker";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import {
  isImplicitStatus,
  isTerminal,
  labelForStatus,
  toneForStatus,
} from "@/features/travels/statusLabels";
import { useParcelDetail } from "@/hooks/api/useParcelDetail";
import { MainTabParamList } from "@/navigation/types";
import { ApiClientError, getErrorMessage, parcelsApi, type Parcel } from "@/services/api";
import { colors } from "@/theme/colors";
import { EditParcelModal, type EditParcelFormValues } from "./EditParcelModal";

type NoticeVariant = "success" | "error" | "warning" | "info";
interface Notice {
  variant: NoticeVariant;
  title?: string;
  message: string;
}

type Nav = BottomTabNavigationProp<MainTabParamList, "ParcelDetailsTab">;
type Route = RouteProp<MainTabParamList, "ParcelDetailsTab">;

const CURRENCY_SYMBOL: Record<string, string> = {
  USD: "$",
  INR: "₹",
  EUR: "€",
  GBP: "£",
};

function formatDeliveryDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatFee(parcel: Parcel): string {
  const symbol = CURRENCY_SYMBOL[parcel.fee_currency] ?? "";
  const amount = `${parcel.fee_offered}`;
  if (symbol) return `${symbol}${amount}`;
  return `${amount} ${parcel.fee_currency}`;
}

function senderInitial(name: string): string {
  const trimmed = name.trim();
  return trimmed ? trimmed.charAt(0).toUpperCase() : "?";
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
      <Text style={styles.title}>Parcel details</Text>
    </View>
  );
}

function StatusPill({ status }: Readonly<{ status: string }>) {
  if (!status || isImplicitStatus(status)) return null;
  const tone = toneForStatus(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
        {labelForStatus(status)}
      </Text>
    </View>
  );
}

function StatusAlert({ status }: Readonly<{ status: string }>) {
  if (status === "delivered" || status === "completed") {
    return (
      <View style={styles.bannerSlot}>
        <FormBanner variant="success" message="Payment released to carrier" />
      </View>
    );
  }
  if (status === "disputed") {
    return (
      <View style={styles.bannerSlot}>
        <FormBanner
          variant="error"
          title="Payment under review"
          message="A dispute is open on this parcel."
        />
      </View>
    );
  }
  return null;
}

function ParcelCard({ parcel }: Readonly<{ parcel: Parcel }>) {
  return (
    <Card style={styles.card}>
      <RouteHeader fromCity={parcel.from_city} toCity={parcel.to_city} kind="parcel" />
      <View style={styles.metricsGrid}>
        <MetricRow>
          <MetricTile label="DELIVERY BY" value={formatDeliveryDate(parcel.delivery_by)} />
          <MetricTile label="WEIGHT" value={`${parcel.weight_kg} kg`} />
        </MetricRow>
        <MetricRow>
          <MetricTile label="FEE" value={formatFee(parcel)} highlight />
          <MetricTile label="CATEGORY" value={parcel.category || "—"} />
        </MetricRow>
      </View>
      <StatusPill status={parcel.status} />
    </Card>
  );
}

function DescriptionCard({ description }: Readonly<{ description: string | null }>) {
  return (
    <Card style={styles.bodyCard}>
      <Text style={styles.bodyLabel}>DESCRIPTION</Text>
      <Text style={styles.bodyText}>{description?.trim() || "No description provided."}</Text>
    </Card>
  );
}

function SenderCard({ sender }: Readonly<{ sender: NonNullable<Parcel["sender"]> }>) {
  return (
    <Card style={styles.senderCard}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{senderInitial(sender.name ?? "")}</Text>
      </View>
      <View style={styles.senderInfo}>
        <Text style={styles.senderName} numberOfLines={2}>
          {sender.name}
        </Text>
        <Text style={styles.senderRole}>Sender</Text>
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
      <Text style={styles.emptyTitle}>We couldn't find that parcel.</Text>
      <Text style={styles.emptySubtitle}>
        {errorMessage ?? "This parcel may have been cancelled or removed."}
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

function ParcelDetailsSkeleton() {
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
        <SkeletonBlock style={styles.skeletonStatusPill} />
      </Card>
      <SkeletonBlock style={styles.skeletonBodyCard} />
      <SkeletonBlock style={styles.skeletonSenderCard} />
      <SkeletonBlock style={styles.skeletonMessageButton} />
      <SkeletonBlock style={styles.skeletonPrimaryButton} />
      <SkeletonBlock style={styles.skeletonCancelButton} />
    </View>
  );
}

export function ParcelDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const parcelId = route.params?.parcelId;

  const { parcel, error, refetch } = useParcelDetail(parcelId);

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  const [cancelPending, setCancelPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Parcels"); // My Travels lives on the "Parcels" tab key
  }, [navigation]);

  // Web's `Message Sender` link goes to `/customer/messages` (the inbox), not
  // a specific conversation. Mobile parity: open the Inbox tab.
  const handleMessageSender = useCallback(() => {
    navigation.navigate("Buddies");
  }, [navigation]);

  const handleEditOpen = useCallback(() => setEditOpen(true), []);
  const handleEditCancel = useCallback(() => {
    if (!editPending) setEditOpen(false);
  }, [editPending]);

  const handleEditSubmit = useCallback(
    async (values: EditParcelFormValues) => {
      if (!parcelId || !parcel) return;
      const data: Parameters<typeof parcelsApi.update>[1] = {};

      if (!values.from_city) {
        setNotice({ variant: "error", title: "Origin city required", message: "Select an origin city." });
        return;
      }
      if (!values.to_city) {
        setNotice({ variant: "error", title: "Destination city required", message: "Select a destination city." });
        return;
      }
      const fromCity = values.from_city === ANY_CITY ? "Any" : values.from_city;
      const toCity = values.to_city === ANY_CITY ? "Any" : values.to_city;
      const curFromCity = parcel.any_from ? "Any" : parcel.from_city;
      const curToCity = parcel.any_to ? "Any" : parcel.to_city;
      const curFromCountry = (parcel.from_country ?? "").toUpperCase() === "US" ? "US" : "IN";
      const curToCountry = (parcel.to_country ?? "").toUpperCase() === "US" ? "US" : "IN";
      if (fromCity !== curFromCity || values.from_country !== curFromCountry) {
        data.from_city = fromCity;
        data.from_country = values.from_country;
        data.any_from = values.from_city === ANY_CITY;
      }
      if (toCity !== curToCity || values.to_country !== curToCountry) {
        data.to_city = toCity;
        data.to_country = values.to_country;
        data.any_to = values.to_city === ANY_CITY;
      }

      const weightNum = Number(values.weight_kg);
      if (
        values.weight_kg !== "" &&
        Number.isFinite(weightNum) &&
        weightNum !== parcel.weight_kg
      ) {
        data.weight_kg = weightNum;
      }
      if (values.description !== (parcel.description ?? "")) {
        data.description = values.description;
      }

      if (Object.keys(data).length === 0) {
        setEditOpen(false);
        return;
      }

      setEditPending(true);
      try {
        await parcelsApi.update(parcelId, data);
        await refetch();
        setEditOpen(false);
        setNotice({
          variant: "success",
          title: "Parcel updated",
          message: "Your changes are saved.",
        });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        setNotice({ variant: "error", title: "Couldn't update parcel", message });
      } finally {
        setEditPending(false);
      }
    },
    [parcelId, parcel, refetch],
  );

  const handleCancelParcel = useCallback(async () => {
    if (!parcelId) return;
    setCancelPending(true);
    try {
      await parcelsApi.delete(parcelId);
      setCancelOpen(false);
      handleBack();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
      setCancelOpen(false);
      setNotice({ variant: "error", title: "Couldn't cancel parcel", message });
    } finally {
      setCancelPending(false);
    }
  }, [parcelId, handleBack]);

  // Avoids a "Parcel not found" flash between route.params arriving and the
  // hook's first refetch firing.
  if (!parcel && !error) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <ParcelDetailsSkeleton />
      </Screen>
    );
  }

  if (error || !parcel) {
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

  const canModify = !isTerminal(parcel.status);

  const editInitial: EditParcelFormValues = {
    from_city: parcel.any_from ? ANY_CITY : (parcel.from_city ?? ""),
    from_country: (parcel.from_country ?? "").toUpperCase() === "US" ? "US" : "IN",
    to_city: parcel.any_to ? ANY_CITY : (parcel.to_city ?? ""),
    to_country: (parcel.to_country ?? "").toUpperCase() === "US" ? "US" : "IN",
    weight_kg: `${parcel.weight_kg ?? ""}`,
    description: parcel.description ?? "",
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

      <ParcelCard parcel={parcel} />

      <StatusAlert status={parcel.status} />

      <DescriptionCard description={parcel.description} />

      {parcel.sender ? <SenderCard sender={parcel.sender} /> : null}

      <Pressable
        style={styles.messageButton}
        onPress={handleMessageSender}
        accessibilityRole="button"
        accessibilityLabel="Message Sender"
      >
        <Ionicons name="chatbubble-ellipses" size={16} color={colors.text} />
        <Text style={styles.messageButtonText}>Message Sender</Text>
      </Pressable>

      {canModify ? (
        <>
          <AppButton
            label="Edit parcel"
            onPress={handleEditOpen}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.primaryActionButton}
          />

          <Pressable
            onPress={() => setCancelOpen(true)}
            style={styles.cancelButton}
            accessibilityRole="button"
            accessibilityLabel="Cancel parcel"
          >
            <Text style={styles.cancelButtonText}>Cancel parcel</Text>
          </Pressable>
        </>
      ) : null}

      <EditParcelModal
        open={editOpen}
        initial={editInitial}
        pending={editPending}
        onCancel={handleEditCancel}
        onSubmit={handleEditSubmit}
      />

      <ConfirmActionModal
        open={cancelOpen}
        title="Cancel this parcel?"
        body="This action cannot be undone. Any pending carrier offers will be withdrawn."
        confirmLabel="Yes, cancel parcel"
        cancelLabel="Keep parcel"
        tone="destructive"
        icon="alert-circle"
        pending={cancelPending}
        onCancel={() => {
          if (!cancelPending) setCancelOpen(false);
        }}
        onConfirm={handleCancelParcel}
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

  statusPill: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  statusPillText: {
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },

  bodyCard: {
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
  },
  bodyLabel: {
    color: colors.subtleText,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.5,
    marginBottom: 6,
  },
  bodyText: {
    color: colors.text,
    fontSize: 14,
    lineHeight: 21,
    fontWeight: "500",
  },

  senderCard: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    marginBottom: 14,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    color: colors.wordmark,
    fontSize: 16,
    fontWeight: "800",
  },
  senderInfo: { flex: 1, minWidth: 0 },
  senderName: { color: colors.text, fontSize: 14, fontWeight: "700" },
  senderRole: { color: colors.mutedText, fontSize: 12, fontWeight: "500", marginTop: 1 },

  messageButton: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 14,
    paddingVertical: 13,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  messageButtonText: { color: colors.text, fontSize: 14, fontWeight: "800" },

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
  skeletonStatusPill: { width: 140, height: 20, borderRadius: 999 },
  skeletonBodyCard: { height: 88, borderRadius: 16, marginBottom: 12 },
  skeletonSenderCard: { height: 64, borderRadius: 16, marginBottom: 14 },
  skeletonMessageButton: { height: 46, borderRadius: 14, marginBottom: 14 },
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
