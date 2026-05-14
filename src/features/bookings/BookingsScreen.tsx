import { Ionicons } from "@expo/vector-icons";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, useNavigation, useRoute, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { useCallback, useEffect, useMemo, useState } from "react";
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
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { useBookings } from "@/hooks/api/useBookings";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  ApiClientError,
  bookingsApi,
  getErrorMessage,
  type Booking,
} from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";

type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "BookingsTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
type Route = RouteProp<MainTabParamList, "BookingsTab">;

const FILTERS: ReadonlyArray<{ label: string; status?: string }> = [
  { label: "All", status: undefined },
  { label: "Active", status: "active" },
  { label: "Completed", status: "delivered" },
  { label: "Cancelled", status: "cancelled" },
];

const STATUS_TONES: Record<string, { bg: string; fg: string }> = {
  pending_payment: { bg: "rgba(245,159,10,0.12)", fg: colors.warning },
  confirmed: { bg: primaryTint.fill12, fg: colors.primary },
  in_transit: { bg: "rgba(245,128,32,0.12)", fg: "#F08020" },
  delivered: { bg: "rgba(34,195,93,0.12)", fg: colors.safe },
  cancelled: { bg: "rgba(220,40,40,0.12)", fg: colors.danger },
  disputed: { bg: "rgba(220,40,40,0.15)", fg: colors.danger },
};

const STATUS_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  pending_payment: "time-outline",
  confirmed: "checkmark-circle",
  in_transit: "car",
  delivered: "cube-outline",
  cancelled: "ban",
  disputed: "alert-circle",
};

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getRole(
  booking: Booking,
  userId: string | undefined,
): "sender" | "carrier" | "unknown" {
  if (!userId) return "unknown";
  if (booking.sender_id === userId) return "sender";
  if (booking.carrier_id === userId) return "carrier";
  return "unknown";
}

// ─────────────── Cancel modal ───────────────

interface CancelBookingModalProps {
  open: boolean;
  pending: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

function CancelBookingModal({
  open,
  pending,
  onCancel,
  onConfirm,
}: Readonly<CancelBookingModalProps>) {
  const [reason, setReason] = useState("");

  const handleConfirm = () => {
    const trimmed = reason.trim();
    if (!trimmed) return;
    onConfirm(trimmed);
  };

  const handleClose = () => {
    if (pending) return;
    setReason("");
    onCancel();
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={handleClose}>
      <Pressable style={styles.modalBackdrop} onPress={handleClose} />
      <View style={styles.modalCenter} pointerEvents="box-none">
        <View style={styles.modalCard}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Cancel Booking?</Text>
            <Pressable onPress={handleClose} hitSlop={8} disabled={pending}>
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>
          <Text style={styles.modalBody}>
            Tell the other party why you're cancelling. This is shared with them.
          </Text>
          <TextInput
            value={reason}
            onChangeText={setReason}
            placeholder="Reason for cancellation..."
            placeholderTextColor={colors.mutedText}
            style={styles.modalInput}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
            autoFocus
          />
          <View style={styles.modalFooter}>
            <Pressable
              onPress={handleClose}
              disabled={pending}
              style={[styles.modalButton, styles.modalButtonSecondary]}
              accessibilityRole="button"
              accessibilityLabel="Keep Booking"
            >
              <Text style={styles.modalButtonSecondaryText}>Keep Booking</Text>
            </Pressable>
            <Pressable
              onPress={handleConfirm}
              disabled={pending || !reason.trim()}
              style={[
                styles.modalButton,
                styles.modalButtonDanger,
                (pending || !reason.trim()) && styles.modalButtonDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm Cancellation"
            >
              {pending ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <Text style={styles.modalButtonDangerText}>Confirm Cancel</Text>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

// ─────────────── Expanded section (mirrors web's expanded card body) ───────────────

interface ExpandedBodyProps {
  bookingId: string;
  role: "sender" | "carrier" | "unknown";
  onNavigateRate: (bookingId: string) => void;
}

function ExpandedBody({
  bookingId,
  role,
  onNavigateRate,
}: Readonly<ExpandedBodyProps>) {
  // Detail fetch only fires when this row is expanded — so the list remains
  // light. Mirrors web's TanStack `useBookingDetail` enabled-on-mount of the
  // expanded card.
  const { booking, timeline, error, refetch } = useBookingDetail(bookingId);

  const [actionPending, setActionPending] = useState<
    null | "pickup" | "cancel" | "generate-otp" | "confirm-otp"
  >(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [otpCode, setOtpCode] = useState("");
  const [generatedOtpVisible, setGeneratedOtpVisible] = useState(false);

  const runAction = useCallback(
    async (
      key: "pickup" | "cancel" | "generate-otp" | "confirm-otp",
      task: () => Promise<unknown>,
      successMessage: string,
    ) => {
      setActionPending(key);
      try {
        await task();
        await refetch();
        showToast({ title: successMessage, variant: "success" });
        return true;
      } catch (err) {
        const message =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        showToast({ title: "Action failed", message, variant: "error" });
        return false;
      } finally {
        setActionPending(null);
      }
    },
    [refetch],
  );

  if (!booking && !error) {
    return (
      <View style={styles.expandedLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error || !booking) {
    return (
      <View style={styles.expandedError}>
        <Text style={styles.expandedErrorText}>
          {error ? getErrorMessage(error) : "Booking unavailable"}
        </Text>
      </View>
    );
  }

  const handleMarkPickup = () =>
    void runAction("pickup", () => bookingsApi.markPickup(booking.id), "Marked as picked up");

  const handleCancelConfirm = async (reason: string) => {
    const ok = await runAction(
      "cancel",
      () => bookingsApi.cancel(booking.id, reason),
      "Booking cancelled",
    );
    if (ok) setCancelOpen(false);
  };

  const handleGenerateOtp = async () => {
    const ok = await runAction(
      "generate-otp",
      () => bookingsApi.generateOtp(booking.id),
      "Delivery code sent",
    );
    if (ok) setGeneratedOtpVisible(true);
  };

  const handleConfirmOtp = async () => {
    const trimmed = otpCode.trim();
    if (trimmed.length === 0) return;
    const ok = await runAction(
      "confirm-otp",
      () => bookingsApi.confirmOtp(booking.id, trimmed),
      "Delivery confirmed",
    );
    if (ok) setOtpCode("");
  };

  // Action gates — mirror web `CustomerBookings.tsx` expanded-card rules.
  // Web has no "Report an issue" link here; disputes are filed from the
  // dedicated `/customer/disputes` page.
  const canCancel = booking.status === "pending_payment" || booking.status === "confirmed";
  const canMarkPickup = booking.status === "confirmed" && role === "carrier";
  const canGenerateOtp = booking.status === "in_transit" && role === "sender";
  const canConfirmOtp = booking.status === "in_transit" && role === "carrier";
  const canRate = booking.status === "delivered";

  return (
    <View style={styles.expandedRoot}>
      {/* Parcel details */}
      {booking.parcel ? (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>Parcel Details</Text>
          <View style={styles.parcelGrid}>
            <View style={styles.parcelCell}>
              <Text style={styles.parcelCellKey}>Category: </Text>
              <Text style={styles.parcelCellValue}>{booking.parcel.category}</Text>
            </View>
            <View style={styles.parcelCell}>
              <Text style={styles.parcelCellKey}>Fee: </Text>
              <Text style={[styles.parcelCellValue, { color: colors.primary }]}>
                ${booking.parcel.fee_offered}
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {/* Sender / Carrier */}
      {(booking.sender || booking.carrier) ? (
        <View style={styles.partiesRow}>
          {booking.sender ? (
            <View style={styles.partyItem}>
              <View style={[styles.partyAvatar, { backgroundColor: primaryTint.fill12 }]}>
                <Text style={[styles.partyAvatarText, { color: colors.primary }]}>
                  {booking.sender.name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={styles.partyKey}>Sender</Text>
                <Text style={styles.partyValue} numberOfLines={2}>
                  {booking.sender.name}
                </Text>
              </View>
            </View>
          ) : null}
          {booking.carrier ? (
            <View style={styles.partyItem}>
              <View style={[styles.partyAvatar, { backgroundColor: "rgba(245,128,32,0.12)" }]}>
                <Text style={[styles.partyAvatarText, { color: "#F08020" }]}>
                  {booking.carrier.name?.charAt(0)?.toUpperCase() ?? "?"}
                </Text>
              </View>
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={styles.partyKey}>Carrier</Text>
                <Text style={styles.partyValue} numberOfLines={2}>
                  {booking.carrier.name}
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      ) : null}

      {/* Timeline */}
      {timeline && timeline.length > 0 ? (
        <View style={styles.expandedSection}>
          <Text style={styles.expandedLabel}>Timeline</Text>
          {timeline.map((e, idx) => (
            <View key={`${e.event}-${e.created_at}-${idx}`} style={styles.timelineRow}>
              <View style={styles.timelineDot} />
              <View style={{ flex: 1 }}>
                <Text style={styles.timelineEvent}>
                  <Text style={styles.timelineEventName}>{e.event.replace(/_/g, " ")}</Text>
                  {e.description ? (
                    <Text style={styles.timelineEventDesc}> - {e.description}</Text>
                  ) : null}
                </Text>
                <Text style={styles.timelineDate}>{formatDateTime(e.created_at)}</Text>
              </View>
            </View>
          ))}
        </View>
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionsWrap}>
        {canMarkPickup ? (
          <Pressable
            style={[styles.actionButton, styles.actionPrimary]}
            onPress={handleMarkPickup}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Mark as Picked Up"
          >
            {actionPending === "pickup" ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <>
                <Ionicons name="car" size={14} color={colors.white} />
                <Text style={styles.actionPrimaryText}>Mark as Picked Up</Text>
              </>
            )}
          </Pressable>
        ) : null}

        {canCancel ? (
          <Pressable
            style={[styles.actionButton, styles.actionDanger]}
            onPress={() => setCancelOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Cancel Booking"
          >
            <Ionicons name="ban" size={14} color={colors.danger} />
            <Text style={styles.actionDangerText}>Cancel Booking</Text>
          </Pressable>
        ) : null}

        {canGenerateOtp ? (
          <View>
            <Pressable
              style={[styles.actionButton, styles.actionSafe]}
              onPress={handleGenerateOtp}
              disabled={actionPending !== null}
              accessibilityRole="button"
              accessibilityLabel="Generate Delivery Code"
            >
              {actionPending === "generate-otp" ? (
                <ActivityIndicator size="small" color={colors.safe} />
              ) : (
                <>
                  <Ionicons name="key-outline" size={14} color={colors.safe} />
                  <Text style={styles.actionSafeText}>Generate Delivery Code</Text>
                </>
              )}
            </Pressable>
            {generatedOtpVisible ? (
              <Text style={styles.helperText}>
                Delivery code has been sent. Share it with your carrier upon delivery.
              </Text>
            ) : null}
          </View>
        ) : null}

        {canConfirmOtp ? (
          <View style={styles.otpRow}>
            <TextInput
              value={otpCode}
              onChangeText={setOtpCode}
              placeholder="Enter delivery code…"
              placeholderTextColor={colors.mutedText}
              style={styles.otpInput}
              keyboardType="number-pad"
              maxLength={6}
              accessibilityLabel="Delivery code"
            />
            <Pressable
              onPress={handleConfirmOtp}
              disabled={actionPending !== null || otpCode.trim().length === 0}
              style={[
                styles.otpConfirmButton,
                (actionPending !== null || otpCode.trim().length === 0) && styles.actionDisabled,
              ]}
              accessibilityRole="button"
              accessibilityLabel="Confirm Delivery"
            >
              {actionPending === "confirm-otp" ? (
                <ActivityIndicator size="small" color={colors.white} />
              ) : (
                <>
                  <Ionicons name="checkmark-circle" size={14} color={colors.white} />
                  <Text style={styles.otpConfirmText}>Confirm Delivery</Text>
                </>
              )}
            </Pressable>
          </View>
        ) : null}

        {canRate ? (
          <Pressable
            style={[styles.actionButton, styles.actionWarning]}
            onPress={() => onNavigateRate(booking.id)}
            accessibilityRole="button"
            accessibilityLabel="Rate Delivery"
          >
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.actionWarningText}>Rate Delivery</Text>
          </Pressable>
        ) : null}
      </View>

      <CancelBookingModal
        open={cancelOpen}
        pending={actionPending === "cancel"}
        onCancel={() => setCancelOpen(false)}
        onConfirm={handleCancelConfirm}
      />
    </View>
  );
}

// ─────────────── Booking row (collapsed + expanded) ───────────────

interface BookingRowProps {
  booking: Booking;
  role: "sender" | "carrier" | "unknown";
  expanded: boolean;
  onToggle: () => void;
  onNavigateRate: (bookingId: string) => void;
}

function BookingRow({
  booking,
  role,
  expanded,
  onToggle,
  onNavigateRate,
}: Readonly<BookingRowProps>) {
  const tone = STATUS_TONES[booking.status] ?? { bg: "#E5E7EB", fg: colors.subtleText };
  const icon = STATUS_ICONS[booking.status] ?? "ellipse";

  return (
    <Card style={styles.bookingCard}>
      <Pressable
        onPress={onToggle}
        style={styles.cardSummary}
        accessibilityRole="button"
        accessibilityLabel={`${expanded ? "Collapse" : "Expand"} booking ${booking.id}`}
        accessibilityState={{ expanded }}
      >
        <View style={styles.cardTop}>
          <View style={styles.cardTopLeft}>
            <Text style={styles.bookingId} numberOfLines={1}>
              {booking.id.slice(0, 8)}…
            </Text>
            {role !== "unknown" ? (
              <View
                style={[
                  styles.roleChip,
                  role === "sender" ? styles.roleChipSender : styles.roleChipCarrier,
                ]}
              >
                <Ionicons
                  name={role === "sender" ? "person-outline" : "car"}
                  size={10}
                  color={role === "sender" ? colors.primary : "#F08020"}
                />
                <Text
                  style={[
                    styles.roleChipText,
                    role === "sender"
                      ? { color: colors.primary }
                      : { color: "#F08020" },
                  ]}
                >
                  {role === "sender" ? "Sender" : "Carrier"}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={styles.cardTopRight}>
            <View style={[styles.statusBadge, { backgroundColor: tone.bg }]}>
              <Ionicons name={icon} size={10} color={tone.fg} />
              <Text style={[styles.statusBadgeText, { color: tone.fg }]}>
                {booking.status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>
            <Ionicons
              name={expanded ? "chevron-up" : "chevron-down"}
              size={16}
              color={colors.mutedText}
            />
          </View>
        </View>

        {booking.parcel ? (
          <View style={styles.routeRow}>
            <Ionicons name="location-outline" size={14} color={colors.primary} />
            <Text style={styles.routeText} numberOfLines={2}>
              {booking.parcel.from_city}
            </Text>
            <Ionicons name="arrow-forward" size={14} color={colors.subtleText} />
            <Text style={styles.routeText} numberOfLines={2}>
              {booking.parcel.to_city}
            </Text>
          </View>
        ) : null}

        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="calendar-outline" size={12} color={colors.subtleText} />
            <Text style={styles.metaText}>{formatDate(booking.created_at)}</Text>
          </View>
          {booking.parcel ? (
            <Text style={styles.feeText}>${booking.parcel.fee_offered}</Text>
          ) : null}
        </View>
      </Pressable>

      {expanded ? (
        <View style={styles.expandedDivider}>
          <ExpandedBody
            bookingId={booking.id}
            role={role}
            onNavigateRate={onNavigateRate}
          />
        </View>
      ) : null}
    </Card>
  );
}

// ─────────────── Screen ───────────────

export function BookingsScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { user } = useAuth();
  const userId = user?.id;

  const [filterIdx, setFilterIdx] = useState(0);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const status = FILTERS[filterIdx]?.status;
  const { bookings, loading, error, refetch } = useBookings({ status });

  // Auto-expand if a notification deep-link or other navigator passed `expandId`.
  // Mirrors web's `/customer/bookings` page where deep-links land on the list
  // and the user finds their booking in the list.
  useEffect(() => {
    const expandId = route.params?.expandId;
    if (expandId && bookings.some((b) => b.id === expandId)) {
      setExpandedId(expandId);
    }
  }, [route.params?.expandId, bookings]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return bookings;
    return bookings.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.parcel?.from_city?.toLowerCase().includes(q) ||
        b.parcel?.to_city?.toLowerCase().includes(q),
    );
  }, [bookings, search]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleToggle = useCallback(
    (id: string) => setExpandedId((prev) => (prev === id ? null : id)),
    [],
  );

  const handleNavigateRate = useCallback(
    (id: string) => navigation.navigate("DeliveryReviewTab", { bookingId: id }),
    [navigation],
  );

  return (
    <Screen onRefresh={refetch}>
      <View style={styles.headerRow}>
        <Pressable
          onPress={handleBack}
          style={styles.backButton}
          accessibilityRole="button"
          accessibilityLabel="Back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <View style={styles.titleBlock}>
          <Text style={styles.title}>My Bookings</Text>
          <Text style={styles.subtitle}>Manage your delivery bookings</Text>
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <Ionicons name="search-outline" size={16} color={colors.subtleText} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search by city, booking ID..."
          placeholderTextColor={colors.subtleText}
          style={styles.searchInput}
          accessibilityLabel="Search bookings"
        />
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map((f, i) => {
          const active = i === filterIdx;
          return (
            <Pressable
              key={f.label}
              onPress={() => {
                setFilterIdx(i);
                setExpandedId(null);
              }}
              style={[styles.chip, active && styles.chipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`Filter: ${f.label}`}
            >
              <Text style={[styles.chipText, active && styles.chipTextActive]}>{f.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {/* Body */}
      {loading && bookings.length === 0 ? (
        <View style={styles.loadingWrap}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingText}>Loading bookings…</Text>
        </View>
      ) : error && bookings.length === 0 ? (
        <Card style={styles.errorCard}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.errorTitle}>Failed to load bookings</Text>
          <Text style={styles.errorBody}>
            {error instanceof Error ? error.message : "Unknown error"}
          </Text>
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
          <Text style={styles.emptyTitle}>No bookings yet</Text>
          <Text style={styles.emptySubtitle}>
            {filterIdx > 0
              ? "Try a different filter."
              : "Browse parcels or trips to create your first booking."}
          </Text>
        </Card>
      ) : (
        <View>
          {filtered.map((booking) => (
            <BookingRow
              key={booking.id}
              booking={booking}
              role={getRole(booking, userId)}
              expanded={expandedId === booking.id}
              onToggle={() => handleToggle(booking.id)}
              onNavigateRate={handleNavigateRate}
            />
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
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
  subtitle: { color: colors.mutedText, fontSize: 13, marginTop: 2, fontWeight: "500" },

  // Search
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.card,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 11,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    color: colors.text,
    fontSize: 14,
    fontWeight: "500",
    padding: 0,
  },

  // Filter chips
  filterRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
    flexWrap: "wrap",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: colors.card,
  },
  chipActive: { backgroundColor: colors.primary },
  chipText: { color: colors.mutedText, fontSize: 13, fontWeight: "700" },
  chipTextActive: { color: colors.white },

  // Cards
  bookingCard: { borderRadius: 16, marginBottom: 12, overflow: "hidden" },
  cardSummary: { paddingHorizontal: 16, paddingVertical: 16 },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
    gap: 8,
  },
  cardTopLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexShrink: 1,
  },
  cardTopRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  bookingId: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  roleChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
  },
  roleChipSender: { backgroundColor: primaryTint.fill10 },
  roleChipCarrier: { backgroundColor: "rgba(245,128,32,0.10)" },
  roleChipText: { fontSize: 10, fontWeight: "700" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  statusBadgeText: { fontSize: 10, fontWeight: "800", letterSpacing: 0.3 },

  routeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
  },
  routeText: {
    color: colors.text,
    fontSize: 15,
    fontWeight: "800",
    flexShrink: 1,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaText: { color: colors.subtleText, fontSize: 12, fontWeight: "500" },
  feeText: { color: colors.primary, fontSize: 13, fontWeight: "800", marginLeft: "auto" },

  // Expanded body
  expandedDivider: {
    borderTopWidth: 1,
    borderTopColor: colors.border,
    paddingHorizontal: 16,
    paddingTop: 14,
    paddingBottom: 16,
  },
  expandedRoot: { gap: 14 },
  expandedSection: { gap: 6 },
  expandedLabel: {
    color: colors.subtleText,
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },
  expandedLoading: { paddingVertical: 12, alignItems: "center" },
  expandedError: { paddingVertical: 12, alignItems: "center" },
  expandedErrorText: { color: colors.danger, fontSize: 13, fontWeight: "600" },

  parcelGrid: { flexDirection: "row", gap: 10, flexWrap: "wrap" },
  parcelCell: { flex: 1, minWidth: 140, flexDirection: "row" },
  parcelCellKey: { color: colors.mutedText, fontSize: 13 },
  parcelCellValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  partiesRow: { flexDirection: "row", gap: 12, flexWrap: "wrap" },
  partyItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 140,
  },
  partyAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  partyAvatarText: { fontSize: 13, fontWeight: "800" },
  partyKey: { color: colors.subtleText, fontSize: 11, fontWeight: "600" },
  partyValue: { color: colors.text, fontSize: 13, fontWeight: "700" },

  // Timeline
  timelineRow: { flexDirection: "row", gap: 8, marginTop: 4 },
  timelineDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 6,
  },
  timelineEvent: { color: colors.text, fontSize: 12, lineHeight: 16 },
  timelineEventName: { color: colors.text, fontWeight: "700", textTransform: "capitalize" },
  timelineEventDesc: { color: colors.mutedText },
  timelineDate: { color: colors.subtleText, fontSize: 11, marginTop: 2 },

  // Actions
  actionsWrap: { gap: 8, flexDirection: "row", flexWrap: "wrap" },
  actionButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  actionPrimary: { backgroundColor: colors.primary },
  actionPrimaryText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  actionDanger: { backgroundColor: "rgba(220,40,40,0.10)" },
  actionDangerText: { color: colors.danger, fontSize: 13, fontWeight: "800" },
  actionSafe: { backgroundColor: "rgba(34,195,93,0.12)" },
  actionSafeText: { color: colors.safe, fontSize: 13, fontWeight: "800" },
  actionWarning: { backgroundColor: "rgba(245,159,10,0.12)" },
  actionWarningText: { color: colors.warning, fontSize: 13, fontWeight: "800" },
  actionDisabled: { opacity: 0.5 },
  helperText: { color: colors.safe, fontSize: 12, fontWeight: "500", marginTop: 6 },

  // OTP entry
  otpRow: { flexDirection: "row", gap: 8, width: "100%" },
  otpInput: {
    flex: 1,
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 9,
    color: colors.text,
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 4,
    fontFamily: "Courier",
  },
  otpConfirmButton: {
    backgroundColor: colors.safe,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 12,
  },
  otpConfirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },

  // Modal
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
    padding: 18,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: { color: colors.text, fontSize: 17, fontWeight: "800" },
  modalBody: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  modalInput: {
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    fontWeight: "500",
    minHeight: 80,
  },
  modalFooter: { flexDirection: "row", gap: 8, justifyContent: "flex-end", marginTop: 4 },
  modalButton: {
    paddingHorizontal: 16,
    paddingVertical: 11,
    borderRadius: 12,
    minWidth: 130,
    alignItems: "center",
    justifyContent: "center",
  },
  modalButtonSecondary: { backgroundColor: colors.surfaceMuted },
  modalButtonSecondaryText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  modalButtonDanger: { backgroundColor: colors.danger },
  modalButtonDangerText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  modalButtonDisabled: { opacity: 0.5 },

  // States
  loadingWrap: { alignItems: "center", justifyContent: "center", paddingVertical: 64, gap: 12 },
  loadingText: { color: colors.mutedText, fontSize: 13, fontWeight: "500" },
  errorCard: { borderRadius: 16, alignItems: "center", paddingVertical: 24, paddingHorizontal: 18 },
  errorTitle: { color: colors.text, fontSize: 16, fontWeight: "800", marginTop: 8 },
  errorBody: {
    color: colors.mutedText,
    fontSize: 13,
    textAlign: "center",
    marginTop: 4,
    marginBottom: 12,
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
    maxWidth: 300,
  },
});
