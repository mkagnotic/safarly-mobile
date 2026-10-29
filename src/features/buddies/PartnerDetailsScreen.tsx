import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp, useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { ModerationMenu } from "@/components/moderation/ModerationMenu";
import { UnavailableContentCard } from "@/components/moderation/UnavailableContentCard";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { showToast } from "@/feedback/appFeedback";
import { buddyEditInitial, buddyEditPayload } from "./editBuddyPayload";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import {
  isImplicitStatus,
  isTerminal,
  labelForBuddyStatus,
  toneForStatus,
} from "@/features/travels/statusLabels";
import { useAuth } from "@/context/AuthContext";
import { isHiddenOwner } from "@/features/moderation/blockFilter";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { useBuddyListingDetail } from "@/hooks/api/useBuddyListingDetail";
import { MainTabParamList } from "@/navigation/types";
import {
  ApiClientError,
  buddiesApi,
  getErrorMessage,
  type BuddyListing,
} from "@/services/api";
import { colors } from "@/theme/colors";
import { formatLocalDate } from "@/utils/travelDate";
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
  // `travel_date*` are date-only columns — never `new Date()`. See formatLocalDate.
  return formatLocalDate(iso, { day: "numeric", month: "short", year: "numeric" });
}

function formatDateRange(listing: BuddyListing): string {
  const from = listing.travel_date_from ?? listing.travel_date;
  const to = listing.travel_date_to ?? listing.travel_date;
  if (!from) return "—";
  const fromLabel = formatLongDate(from);
  if (!to || from === to) return fromLabel;
  return `${fromLabel} → ${formatLongDate(to)}`;
}

function DetailsHeader({ onBack, right }: Readonly<{ onBack: () => void; right?: ReactNode }>) {
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
      <Text style={styles.title}>Buddy listing</Text>
      {right}
    </View>
  );
}

function StatusPill({ status }: Readonly<{ status: string }>) {
  // Buddy-only wording (27 Oct 2026), never the parcel labels.
  const label = labelForBuddyStatus(status);
  if (!status || isImplicitStatus(status) || !label) return null;
  const tone = toneForStatus(status);
  return (
    <View style={[styles.statusPill, { backgroundColor: tone.bg }]}>
      <Text style={[styles.statusPillText, { color: tone.fg }]} numberOfLines={1}>
        {label}
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
          <MetricTile label="Dates" value={formatDateRange(listing)} />
          <MetricTile label="Airline" value={listing.airline?.trim() || "—"} />
        </MetricRow>
        <MetricRow>
          <MetricTile label="Age" value={listing.age != null ? `${listing.age}` : "—"} />
          <MetricTile
            label="Languages"
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
      <Text style={styles.emptyTitle}>Buddy listing not found.</Text>
      <Text style={styles.emptySubtitle}>
        {errorMessage ?? "It may have been removed."}
      </Text>
      <AppButton
        label="Back to My Travels"
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

  const { listing, loading, error, refetch } = useBuddyListingDetail(listingId);
  const { user } = useAuth();
  const { hiddenUserIds } = useBlockedUsers();

  const [editOpen, setEditOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editPending, setEditPending] = useState(false);
  // The server's refusal, shown inside the modal (the banner sits behind it).
  const [editError, setEditError] = useState<string | null>(null);
  const [cancelPending, setCancelPending] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Parcels", { tab: "partners" }); // My Travels lives on the "Parcels" tab key
  }, [navigation]);

  const handleEditOpen = useCallback(() => {
    setEditError(null);
    setEditOpen(true);
  }, []);
  const handleEditCancel = useCallback(() => {
    if (!editPending) setEditOpen(false);
  }, [editPending]);

  const handleEditSubmit = useCallback(
    async (values: EditBuddyListingFormValues) => {
      if (!listingId || !listing) return;

      // Full upsert body, countries included (editBuddyPayload.ts, shared with My Travels).
      const payload = buddyEditPayload(values);

      setEditPending(true);
      setEditError(null);
      try {
        await buddiesApi.update(listingId, payload);
        await refetch();
        setEditOpen(false);
        // Same toast as My Travels (28 Oct 2026).
        showToast({ title: "Buddy listing updated", variant: "success" });
      } catch (err) {
        setEditError(err instanceof ApiClientError ? err.message : getErrorMessage(err as Error));
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

  // Only a request that is actually in flight earns the skeleton. This used to
  // read `!listing && !error`, which is exactly the shape of the ordinary
  // not-found case - a listing that was cancelled or removed, or a link that
  // arrived without a `listingId` - so those left the screen on a skeleton
  // forever, with nothing to read and nothing to tap.
  if (loading && !listing && !error) {
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

  const ownerIds = [listing.user_id, listing.user?.id, listing.user_profiles?.id];
  const isOwner = !!user?.id && ownerIds.includes(user.id);
  // Only the person who posted the listing may edit or remove it.
  const canModify = isOwner && !isTerminal(listing.status);

  // A blocked person's listing (either direction), reached by deep link.
  if (!isOwner && isHiddenOwner(ownerIds, hiddenUserIds)) {
    return (
      <Screen onRefresh={refetch}>
        <DetailsHeader onBack={handleBack} />
        <UnavailableContentCard onBack={handleBack} />
      </Screen>
    );
  }

  const editInitial: EditBuddyListingFormValues = buddyEditInitial(listing, {
    india: INDIA_CITIES,
    usa: USA_CITIES,
  });

  return (
    <Screen onRefresh={refetch}>
      <DetailsHeader
        onBack={handleBack}
        right={
          isOwner ? null : (
            <ModerationMenu
              target={{ type: "buddy_listing", id: listing.id }}
              reportLabel="Report listing"
            />
          )
        }
      />

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

      <BodyCard label="Bio" value={listing.bio} />
      <BodyCard label="Interests" value={listing.interests} />
      {listing.layover ? <BodyCard label="Layover" value={listing.layover} /> : null}

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
        serverError={editError}
      />

      <ConfirmActionModal
        open={cancelOpen}
        title="Remove this buddy listing?"
        body="It will no longer appear in search or My Travels. This can't be undone."
        confirmLabel="Remove listing"
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
    textTransform: "uppercase",
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
  emptyButtonWrap: { alignSelf: "center", width: "100%", maxWidth: 240 },
});
