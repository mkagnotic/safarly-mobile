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
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import {
  isImplicitStatus,
  isTerminal,
  labelForStatus,
  toneForStatus,
} from "@/features/travels/statusLabels";
import { useBuddyListingDetail } from "@/hooks/api/useBuddyListingDetail";
import { MainTabParamList } from "@/navigation/types";
import {
  ApiClientError,
  buddiesApi,
  getErrorMessage,
  type BuddyListing,
} from "@/services/api";
import { colors } from "@/theme/colors";
import {
  EditBuddyListingModal,
  type EditBuddyListingFormValues,
} from "./EditBuddyListingModal";

type NoticeVariant = "success" | "error" | "warning" | "info";
interface Notice {
  variant: NoticeVariant;
  title?: string;
  message: string;
}

type Nav = BottomTabNavigationProp<MainTabParamList, "PartnerDetailsTab">;
type Route = RouteProp<MainTabParamList, "PartnerDetailsTab">;

function formatLongDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(listing: BuddyListing): string {
  const from = listing.travel_date_from ?? listing.travel_date;
  const to = listing.travel_date_to ?? listing.travel_date;
  if (!from) return "—";
  const fromLabel = formatLongDate(from);
  if (!to || from === to) return fromLabel;
  return `${fromLabel} → ${formatLongDate(to)}`;
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
      <Text style={styles.title}>Partner details</Text>
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

function PartnerCard({ listing }: Readonly<{ listing: BuddyListing }>) {
  return (
    <Card style={styles.card}>
      <RouteHeader fromCity={listing.from_city} toCity={listing.to_city} kind="trip" />
      <View style={styles.metricsGrid}>
        <MetricRow>
          <MetricTile label="DATES" value={formatDateRange(listing)} />
          <MetricTile label="AIRLINE" value={listing.airline?.trim() || "—"} />
        </MetricRow>
        <MetricRow>
          <MetricTile label="AGE" value={listing.age != null ? `${listing.age}` : "—"} />
          <MetricTile
            label="LANGUAGES"
            value={
              listing.languages && listing.languages.length > 0
                ? listing.languages.join(", ")
                : "—"
            }
            highlight
          />
        </MetricRow>
      </View>
      <StatusPill status={listing.status} />
    </Card>
  );
}

function BodyCard({
  label,
  value,
}: Readonly<{ label: string; value: string | null | undefined }>) {
  return (
    <Card style={styles.bodyCard}>
      <Text style={styles.bodyLabel}>{label}</Text>
      <Text style={styles.bodyText}>{value?.trim() ? value : "Not provided."}</Text>
    </Card>
  );
}

function NotFoundCard({
  onBack,
  errorMessage,
}: Readonly<{ onBack: () => void; errorMessage?: string }>) {
  return (
    <Card style={styles.emptyCard}>
      <Text style={styles.emptyTitle}>We couldn't find that listing.</Text>
      <Text style={styles.emptySubtitle}>
        {errorMessage ?? "This buddy listing may have been removed or cancelled."}
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

function PartnerDetailsSkeleton() {
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
      <SkeletonBlock style={styles.skeletonBodyCardShort} />
      <SkeletonBlock style={styles.skeletonPrimaryButton} />
      <SkeletonBlock style={styles.skeletonCancelButton} />
    </View>
  );
}

export function PartnerDetailsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const listingId = route.params?.listingId;

  const { listing, error, refetch } = useBuddyListingDetail(listingId);

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
    async (values: EditBuddyListingFormValues) => {
      if (!listingId || !listing) return;

      // The modal validates before calling this, so every field is present and
      // in range by now. The buddy-handler PUT is still a full upsert — it nulls
      // any field omitted from the payload — so this must stay exhaustive.
      const ymd = values.travel_date.trim();
      const payload = {
        from_city: values.from_city === ANY_CITY ? "Any" : values.from_city,
        to_city: values.to_city === ANY_CITY ? "Any" : values.to_city,
        // Single-date listing: buddy_listings has no date-mode column, so the
        // "single" case is expressed as from === to.
        travel_date: ymd,
        travel_date_from: ymd,
        travel_date_to: ymd,
        airline: values.airline.trim(),
        bio: values.bio.trim(),
        age: values.age ? Number.parseInt(values.age, 10) : undefined,
        languages: values.languages,
        interests: values.interests.trim(),
        layover: values.layover.trim(),
      };

      setEditPending(true);
      try {
        await buddiesApi.update(listingId, payload);
        await refetch();
        setEditOpen(false);
        setNotice({
          variant: "success",
          title: "Listing updated",
          message: "Your changes are saved.",
        });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        setNotice({ variant: "error", title: "Couldn't update listing", message });
      } finally {
        setEditPending(false);
      }
    },
    [listingId, listing, refetch],
  );

  const handleCancelListing = useCallback(async () => {
    if (!listingId) return;
    setCancelPending(true);
    try {
      await buddiesApi.deleteListing(listingId);
      setCancelOpen(false);
      handleBack();
    } catch (err) {
      const message =
        err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
      setCancelOpen(false);
      setNotice({ variant: "error", title: "Couldn't remove listing", message });
    } finally {
      setCancelPending(false);
    }
  }, [listingId, handleBack]);

  if (!listing && !error) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <PartnerDetailsSkeleton />
      </Screen>
    );
  }

  if (error || !listing) {
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

  const canModify = !isTerminal(listing.status);

  const editInitial: EditBuddyListingFormValues = {
    from_city: listing.from_city === "Any" ? ANY_CITY : listing.from_city,
    from_country: USA_CITIES.includes(listing.from_city) ? "US" : "IN",
    to_city: listing.to_city === "Any" ? ANY_CITY : listing.to_city,
    to_country: INDIA_CITIES.includes(listing.to_city) ? "IN" : "US",
    travel_date: listing.travel_date_from ?? listing.travel_date ?? "",
    airline: listing.airline ?? "",
    age: listing.age != null ? String(listing.age) : "",
    languages: listing.languages ?? [],
    interests: listing.interests ?? "",
    layover: listing.layover ?? "",
    bio: listing.bio ?? "",
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

      <PartnerCard listing={listing} />

      <BodyCard label="BIO" value={listing.bio} />
      <BodyCard label="INTERESTS" value={listing.interests} />
      {listing.layover ? <BodyCard label="LAYOVER" value={listing.layover} /> : null}

      {canModify ? (
        <>
          <AppButton
            label="Edit listing"
            onPress={handleEditOpen}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.primaryActionButton}
          />

          <Pressable
            onPress={() => setCancelOpen(true)}
            style={styles.cancelButton}
            accessibilityRole="button"
            accessibilityLabel="Remove listing"
          >
            <Text style={styles.cancelButtonText}>Remove listing</Text>
          </Pressable>
        </>
      ) : null}

      <EditBuddyListingModal
        open={editOpen}
        initial={editInitial}
        pending={editPending}
        onCancel={handleEditCancel}
        onSubmit={handleEditSubmit}
      />

      <ConfirmActionModal
        open={cancelOpen}
        title="Remove this listing?"
        body="This action cannot be undone. Your travel buddy request will no longer appear in search."
        confirmLabel="Yes, remove listing"
        cancelLabel="Keep listing"
        tone="destructive"
        icon="alert-circle"
        pending={cancelPending}
        onCancel={() => {
          if (!cancelPending) setCancelOpen(false);
        }}
        onConfirm={handleCancelListing}
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

  primaryActionButton: { alignSelf: "stretch", marginBottom: 12, marginTop: 4 },
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
  skeletonBodyCardShort: { height: 64, borderRadius: 16, marginBottom: 12 },
  skeletonPrimaryButton: { height: 48, borderRadius: 16, marginBottom: 12, marginTop: 4 },
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
