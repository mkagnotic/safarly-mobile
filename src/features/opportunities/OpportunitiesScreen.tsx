import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { showToast } from "@/feedback/appFeedback";
import { useOpportunities } from "@/hooks/api/useOpportunities";
import { useTrips } from "@/hooks/api/useTrips";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  ApiClientError,
  carriersApi,
  getErrorMessage,
  type Parcel,
  type Trip,
} from "@/services/api";
import { colors } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "OpportunitiesTab">,
  NativeStackNavigationProp<RootStackParamList>
>;

const PER_PAGE = 12; // matches web `CustomerOpportunities.tsx`

const CATEGORIES = ["All", "Documents", "Gifts", "Medications"] as const;
type Category = (typeof CATEGORIES)[number];

function formatDeliveryDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTripDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function getInitials(name: string | undefined): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// ─────────────── Trip picker modal ───────────────

interface TripPickerModalProps {
  open: boolean;
  trips: Trip[];
  selectedTripId: string;
  onSelect: (tripId: string) => void;
  onClose: () => void;
}

function TripPickerModal({
  open,
  trips,
  selectedTripId,
  onSelect,
  onClose,
}: Readonly<TripPickerModalProps>) {
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.modalBackdrop} onPress={onClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Trip</Text>
            <Pressable onPress={onClose} hitSlop={8}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          {trips.length === 0 ? (
            <Text style={styles.modalEmpty}>You don't have any trips yet.</Text>
          ) : (
            <View style={styles.modalList}>
              {trips.map((trip) => {
                const active = trip.id === selectedTripId;
                return (
                  <Pressable
                    key={trip.id}
                    onPress={() => {
                      onSelect(trip.id);
                      onClose();
                    }}
                    style={[styles.tripOption, active && styles.tripOptionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={styles.tripOptionRoute} numberOfLines={2}>
                        {trip.from_city} → {trip.to_city}
                      </Text>
                      <Text style={styles.tripOptionDate}>
                        {formatTripDate(trip.travel_date)}
                      </Text>
                    </View>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─────────────── Inline bid form ───────────────

interface BidFormProps {
  parcel: Parcel;
  trips: Trip[];
  pending: boolean;
  onSubmit: (values: {
    selectedTripId: string;
    offerAmount: string;
    message: string;
  }) => void;
  onListTrip: () => void;
}

function BidForm({ parcel, trips, pending, onSubmit, onListTrip }: Readonly<BidFormProps>) {
  const [selectedTripId, setSelectedTripId] = useState("");
  const [offerAmount, setOfferAmount] = useState(`${parcel.fee_offered}`);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);

  const selectedTrip = trips.find((t) => t.id === selectedTripId);

  const handleSubmit = () => {
    setFormError("");
    if (!selectedTripId) {
      setFormError("Please select a trip.");
      return;
    }
    const amount = parseFloat(offerAmount);
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Offer amount must be greater than 0.");
      return;
    }
    onSubmit({ selectedTripId, offerAmount, message });
  };

  return (
    <View style={styles.bidForm}>
      {/* Trip select */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Select Trip *</Text>
        <Pressable
          onPress={() => setPickerOpen(true)}
          style={styles.tripDropdown}
          accessibilityRole="button"
          accessibilityLabel="Choose a trip"
          disabled={pending}
        >
          <Text
            style={[
              styles.tripDropdownText,
              !selectedTrip && { color: colors.mutedText },
            ]}
            numberOfLines={2}
          >
            {selectedTrip
              ? `${selectedTrip.from_city} → ${selectedTrip.to_city} (${formatTripDate(selectedTrip.travel_date)})`
              : "Choose a trip..."}
          </Text>
          <Ionicons name="chevron-down" size={14} color={colors.mutedText} />
        </Pressable>
        {trips.length === 0 ? (
          <Text style={styles.fieldHelpRow}>
            No trips listed.{" "}
            <Text style={styles.fieldHelpLink} onPress={onListTrip}>
              Create one first
            </Text>
          </Text>
        ) : null}
      </View>

      {/* Offer amount */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Offer Amount ($) *</Text>
        <TextInput
          value={offerAmount}
          onChangeText={setOfferAmount}
          keyboardType="decimal-pad"
          placeholder="0.00"
          placeholderTextColor={colors.mutedText}
          style={styles.input}
          editable={!pending}
        />
      </View>

      {/* Message */}
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>Message (optional)</Text>
        <TextInput
          value={message}
          onChangeText={setMessage}
          placeholder="Add a note to the sender..."
          placeholderTextColor={colors.mutedText}
          style={[styles.input, styles.inputMultiline]}
          multiline
          numberOfLines={2}
          textAlignVertical="top"
          editable={!pending}
        />
      </View>

      {formError ? <Text style={styles.formError}>{formError}</Text> : null}

      <Pressable
        onPress={handleSubmit}
        disabled={pending}
        style={[styles.submitButton, pending && styles.submitDisabled]}
        accessibilityRole="button"
        accessibilityLabel="Submit Offer"
      >
        {pending ? (
          <ActivityIndicator size="small" color={colors.white} />
        ) : (
          <>
            <Ionicons name="paper-plane" size={14} color={colors.white} />
            <Text style={styles.submitText}>Submit Offer</Text>
          </>
        )}
      </Pressable>

      <TripPickerModal
        open={pickerOpen}
        trips={trips}
        selectedTripId={selectedTripId}
        onSelect={setSelectedTripId}
        onClose={() => setPickerOpen(false)}
      />
    </View>
  );
}

// ─────────────── Opportunity card ───────────────

interface OpportunityCardProps {
  parcel: Parcel;
  trips: Trip[];
  expanded: boolean;
  submitted: boolean;
  pending: boolean;
  onToggle: () => void;
  onSubmit: (values: {
    parcelId: string;
    selectedTripId: string;
    offerAmount: string;
    message: string;
  }) => void;
  onListTrip: () => void;
}

function OpportunityCard({
  parcel,
  trips,
  expanded,
  submitted,
  pending,
  onToggle,
  onSubmit,
  onListTrip,
}: Readonly<OpportunityCardProps>) {
  const sender = parcel.sender;

  return (
    <Card style={styles.oppCard}>
      <View style={styles.cardTop}>
        {parcel.category ? (
          <View style={styles.categoryBadge}>
            <Text style={styles.categoryText}>{parcel.category.toUpperCase()}</Text>
          </View>
        ) : null}
        {submitted ? (
          <View style={styles.submittedBadge}>
            <Text style={styles.submittedText}>Offer Submitted</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.routeRow}>
        <Ionicons name="location-outline" size={14} color={colors.primary} />
        <Text style={styles.routeText} numberOfLines={2}>
          {parcel.from_city}
        </Text>
        <Ionicons name="arrow-forward" size={14} color={colors.subtleText} />
        <Text style={styles.routeText} numberOfLines={2}>
          {parcel.to_city}
        </Text>
      </View>

      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="barbell-outline" size={12} color={colors.subtleText} />
          <Text style={styles.metaText}>{parcel.weight_kg} kg</Text>
        </View>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={12} color={colors.subtleText} />
          <Text style={styles.metaText}>{formatDeliveryDate(parcel.delivery_by)}</Text>
        </View>
      </View>

      <View style={styles.feeRow}>
        <Text style={styles.feeAmount}>${parcel.fee_offered}</Text>
        <Text style={styles.feeLabel}> offered</Text>
      </View>

      {sender ? (
        <View style={styles.senderRow}>
          <View style={styles.senderAvatar}>
            <Text style={styles.senderAvatarText}>{getInitials(sender.name)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.senderName} numberOfLines={2}>
              {sender.name}
            </Text>
            {typeof sender.rating === "number" ? (
              <View style={styles.senderRatingRow}>
                <Ionicons name="star" size={10} color={colors.warning} />
                <Text style={styles.senderRatingText}>{sender.rating.toFixed(1)}</Text>
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <Pressable
        onPress={onToggle}
        disabled={submitted}
        style={[
          styles.makeOfferButton,
          submitted && styles.makeOfferSubmitted,
          !submitted && expanded && styles.makeOfferExpanded,
        ]}
        accessibilityRole="button"
        accessibilityLabel={
          submitted ? "Offer submitted" : expanded ? "Cancel offer" : "Make offer"
        }
      >
        {submitted ? (
          <Text style={styles.makeOfferSubmittedText}>Offer Submitted</Text>
        ) : (
          <>
            <Text style={styles.makeOfferText}>{expanded ? "Cancel" : "Make Offer"}</Text>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={14}
              color={colors.white}
            />
          </>
        )}
      </Pressable>

      {expanded && !submitted ? (
        <BidForm
          parcel={parcel}
          trips={trips}
          pending={pending}
          onSubmit={(values) =>
            onSubmit({
              parcelId: parcel.id,
              ...values,
            })
          }
          onListTrip={onListTrip}
        />
      ) : null}
    </Card>
  );
}

// ─────────────── Screen ───────────────

export function OpportunitiesScreen() {
  const navigation = useNavigation<Nav>();
  const { opportunities, loading, loadingMore, error, hasMore, total, refetch, loadMore } =
    useOpportunities({ perPage: PER_PAGE });
  // The user's own trips populate the bid-form's trip dropdown.
  const { trips } = useTrips({ filter: "my_trips" });

  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<Category>("All");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set());
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return opportunities.filter((p) => {
      const matchSearch =
        !q ||
        p.from_city.toLowerCase().includes(q) ||
        p.to_city.toLowerCase().includes(q);
      const matchCategory =
        categoryFilter === "All" ||
        (p.category ?? "").toLowerCase() === categoryFilter.toLowerCase();
      return matchSearch && matchCategory;
    });
  }, [opportunities, searchQuery, categoryFilter]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleListTrip = useCallback(() => {
    navigation.navigate("ListTripTab");
  }, [navigation]);

  const handleToggle = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  const handleSubmit = useCallback(
    async (values: {
      parcelId: string;
      selectedTripId: string;
      offerAmount: string;
      message: string;
    }) => {
      setPendingId(values.parcelId);
      try {
        await carriersApi.submitBid(values.parcelId, {
          trip_id: values.selectedTripId,
          offer_amount: parseFloat(values.offerAmount),
          message: values.message.trim() || undefined,
        });
        setSubmittedIds((prev) => {
          const next = new Set(prev);
          next.add(values.parcelId);
          return next;
        });
        setExpandedId(null);
        showToast({
          title: "Your offer has been submitted!",
          variant: "success",
        });
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        showToast({ title: "Could not submit offer", message, variant: "error" });
      } finally {
        setPendingId(null);
      }
    },
    [],
  );

  return (
    <Screen onRefresh={refetch}>
      {/* Header */}
      <View style={styles.headerWrap}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>Delivery Opportunities</Text>
          <Text style={styles.subtitle}>
            Browse parcels that match your travel routes and earn money by delivering them.
          </Text>
        </View>
      </View>

      {/* Search + Category filter */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.subtleText} />
        <TextInput
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholder="Search by route (from / to city)..."
          placeholderTextColor={colors.subtleText}
          style={styles.searchInput}
          accessibilityLabel="Search opportunities"
        />
      </View>

      <Pressable
        onPress={() => setCategoryPickerOpen(true)}
        style={styles.categorySelect}
        accessibilityRole="button"
        accessibilityLabel="Category filter"
      >
        <Text style={styles.categorySelectLabel}>
          {categoryFilter === "All" ? "All Categories" : categoryFilter}
        </Text>
        <Ionicons name="chevron-down" size={14} color={colors.mutedText} />
      </Pressable>

      <Modal
        visible={categoryPickerOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setCategoryPickerOpen(false)}
      >
        <Pressable style={styles.modalBackdrop} onPress={() => setCategoryPickerOpen(false)} />
        <View style={styles.modalCenter} pointerEvents="box-none">
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter by category</Text>
              <Pressable onPress={() => setCategoryPickerOpen(false)} hitSlop={8}>
                <Ionicons name="close" size={20} color={colors.mutedText} />
              </Pressable>
            </View>
            <View style={styles.modalList}>
              {CATEGORIES.map((c) => {
                const active = c === categoryFilter;
                return (
                  <Pressable
                    key={c}
                    onPress={() => {
                      setCategoryFilter(c);
                      setCategoryPickerOpen(false);
                    }}
                    style={[styles.tripOption, active && styles.tripOptionActive]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Text style={styles.tripOptionRoute}>
                      {c === "All" ? "All Categories" : c}
                    </Text>
                    {active ? (
                      <Ionicons name="checkmark-circle" size={18} color={colors.primary} />
                    ) : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
        </View>
      </Modal>

      {/* Body */}
      {loading && opportunities.length === 0 ? (
        <View style={styles.centeredWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredText}>Loading opportunities…</Text>
        </View>
      ) : error && opportunities.length === 0 ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Failed to load opportunities</Text>
          <Text style={styles.errorBody}>{getErrorMessage(error)}</Text>
          <Pressable
            onPress={() => void refetch()}
            style={styles.retryButton}
            accessibilityRole="button"
            accessibilityLabel="Try again"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </Card>
      ) : filtered.length === 0 ? (
        <Card style={styles.emptyCard}>
          <View style={styles.emptyIconBox}>
            <Ionicons name="cube-outline" size={28} color={colors.primary} />
          </View>
          <Text style={styles.emptyTitle}>No opportunities found</Text>
          <Text style={styles.emptySubtitle}>
            {searchQuery || categoryFilter !== "All"
              ? "Try adjusting your search or filters."
              : "No open parcels available right now. Make sure you have a trip listed so we can match you!"}
          </Text>
          {!searchQuery && categoryFilter === "All" ? (
            <Pressable
              onPress={handleListTrip}
              style={styles.emptyCta}
              accessibilityRole="button"
              accessibilityLabel="List a Trip"
            >
              <Text style={styles.emptyCtaText}>List a Trip</Text>
            </Pressable>
          ) : null}
        </Card>
      ) : (
        <View>
          {filtered.map((parcel) => (
            <OpportunityCard
              key={parcel.id}
              parcel={parcel}
              trips={trips}
              expanded={expandedId === parcel.id}
              submitted={submittedIds.has(parcel.id)}
              pending={pendingId === parcel.id}
              onToggle={() => handleToggle(parcel.id)}
              onSubmit={(values) => void handleSubmit(values)}
              onListTrip={handleListTrip}
            />
          ))}

          {hasMore ? (
            <Pressable
              onPress={() => void loadMore()}
              style={[styles.loadMoreButton, loadingMore && styles.loadMoreDisabled]}
              disabled={loadingMore}
              accessibilityRole="button"
              accessibilityLabel="Load more opportunities"
            >
              {loadingMore ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={styles.loadMoreText}>Load more</Text>
              )}
            </Pressable>
          ) : opportunities.length > 0 ? (
            <Text style={styles.endText}>
              {total > 0 ? `Showing all ${total} opportunities` : "End of opportunities"}
            </Text>
          ) : null}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Header
  headerWrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 8,
    marginBottom: 14,
    gap: 10,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  titleBlock: { flex: 1 },
  title: { color: colors.text, fontSize: 22, lineHeight: 28, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 4, fontWeight: "500" },

  // Search + category
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 10,
    gap: 8,
  },
  searchInput: { flex: 1, color: colors.text, fontSize: 14, fontWeight: "500", padding: 0 },
  categorySelect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 14,
    gap: 8,
  },
  categorySelectLabel: { color: colors.text, fontSize: 14, fontWeight: "600" },

  // Card
  oppCard: {
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 16,
    marginBottom: 12,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  categoryBadge: {
    backgroundColor: colors.surfaceTintPrimary,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
  },
  categoryText: {
    color: colors.primary,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  submittedBadge: {
    backgroundColor: "rgba(34,195,93,0.12)",
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 8,
    marginLeft: "auto",
  },
  submittedText: {
    color: colors.safe,
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 0.3,
    textTransform: "uppercase",
  },
  routeRow: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  routeText: { color: colors.text, fontSize: 15, fontWeight: "800", flexShrink: 1 },
  metaRow: { flexDirection: "row", gap: 14, marginBottom: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },
  feeRow: { flexDirection: "row", alignItems: "baseline", marginBottom: 10 },
  feeAmount: { color: colors.primary, fontSize: 20, fontWeight: "800" },
  feeLabel: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },

  senderRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingTop: 12,
    paddingBottom: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
  senderAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accent,
    alignItems: "center",
    justifyContent: "center",
  },
  senderAvatarText: { color: colors.primaryForeground, fontSize: 11, fontWeight: "800" },
  senderName: { color: colors.text, fontSize: 13, fontWeight: "700" },
  senderRatingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  senderRatingText: { color: colors.subtleText, fontSize: 10, fontWeight: "600" },

  makeOfferButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  makeOfferExpanded: { backgroundColor: colors.subtleText },
  makeOfferSubmitted: { backgroundColor: "rgba(34,195,93,0.12)" },
  makeOfferText: { color: colors.white, fontSize: 14, fontWeight: "800" },
  makeOfferSubmittedText: { color: colors.safe, fontSize: 14, fontWeight: "800" },

  // Bid form
  bidForm: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: 12,
  },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontSize: 12, fontWeight: "700" },
  fieldHelpRow: { color: colors.subtleText, fontSize: 11, marginTop: 4 },
  fieldHelpLink: {
    color: colors.primary,
    fontWeight: "700",
    textDecorationLine: "underline",
  },
  input: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    fontSize: 14,
    fontWeight: "500",
  },
  inputMultiline: { minHeight: 64, paddingTop: 11 },
  tripDropdown: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  tripDropdownText: { color: colors.text, fontSize: 14, fontWeight: "500", flex: 1 },
  formError: { color: colors.danger, fontSize: 12, fontWeight: "700" },
  submitButton: {
    backgroundColor: colors.primary,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
    borderRadius: 12,
  },
  submitDisabled: { opacity: 0.5 },
  submitText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  // Modal (trip + category pickers)
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  modalCenter: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 16,
    gap: 12,
    maxHeight: "70%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: colors.text, fontSize: 16, fontWeight: "800" },
  modalEmpty: { color: colors.mutedText, fontSize: 13, paddingVertical: 16, textAlign: "center" },
  modalList: { gap: 6 },
  tripOption: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 11,
    gap: 8,
  },
  tripOptionActive: {
    backgroundColor: colors.surfaceTintPrimary,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  tripOptionRoute: { color: colors.text, fontSize: 13, fontWeight: "700" },
  tripOptionDate: { color: colors.subtleText, fontSize: 11, marginTop: 1 },

  // States
  centeredWrap: { alignItems: "center", paddingVertical: 64, gap: 12 },
  centeredText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  errorCard: {
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 24,
    paddingHorizontal: 18,
  },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
    maxWidth: 320,
  },
  retryButton: {
    backgroundColor: colors.primary,
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 12,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  emptyCard: {
    borderRadius: 16,
    alignItems: "center",
    paddingVertical: 28,
    paddingHorizontal: 18,
  },
  emptyIconBox: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: colors.surfaceWarm,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 8,
  },
  emptyTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginBottom: 4 },
  emptySubtitle: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 12,
  },
  emptyCta: {
    backgroundColor: colors.primary,
    paddingHorizontal: 20,
    paddingVertical: 11,
    borderRadius: 12,
  },
  emptyCtaText: { color: colors.white, fontSize: 14, fontWeight: "800" },

  // Load more
  loadMoreButton: {
    marginTop: 6,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  loadMoreDisabled: { opacity: 0.6 },
  loadMoreText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  endText: {
    textAlign: "center",
    color: colors.subtleText,
    fontSize: 12,
    fontWeight: "500",
    marginTop: 14,
    marginBottom: 8,
  },
});
