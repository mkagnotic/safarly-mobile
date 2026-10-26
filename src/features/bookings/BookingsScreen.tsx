import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRoute } from "@react-navigation/native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, FlatList, RefreshControl, Text, TextInput, View, type ListRenderItemInfo } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { FormBanner } from "@/components/ui/FormBanner";
import { Screen } from "@/components/ui/Screen";
import { ListSkeleton } from "@/components/ui/Skeletons";
import { useAuth } from "@/context/AuthContext";
import { bookingFee, feeBreakdown } from "@/features/bookings/paymentMath";
import { HandoffPlanCard } from "@/features/bookings/HandoffPlanCard";
import { ParcelReturnCard } from "@/features/bookings/ParcelReturnCard";
import { JourneyActionsCard } from "@/features/bookings/JourneyActionsCard";
import { journeyStepShort, currentJourneyStep } from "@/utils/journeySteps";
import { JourneyProgress } from "@/features/bookings/JourneyProgress";
import { useBookings } from "@/hooks/api/useBookings";
import { bookingsApi, type Booking } from "@/services/api";
import { colors } from "@/theme/colors";
import { formatMoney } from "@/utils/money";
import { styles } from "@/features/bookings/BookingsScreen.styles";
import { sharedStyles } from "@/features/bookings/bookingsStyles";
import { AcceptHandoffStep } from "@/features/bookings/components/AcceptHandoffStep";
import { AwaitingPaymentNotice } from "@/features/bookings/components/AwaitingPaymentNotice";
import { BookingRowSummary } from "@/features/bookings/components/BookingRowSummary";
import { BookingTimeline } from "@/features/bookings/components/BookingTimeline";
import { BookingsEmptyCard } from "@/features/bookings/components/BookingsEmptyCard";
import { ConfirmDeliveryStep } from "@/features/bookings/components/ConfirmDeliveryStep";
import { DeliveryCodePanel } from "@/features/bookings/components/DeliveryCodePanel";
import { ExpandedBookingModals } from "@/features/bookings/components/ExpandedBookingModals";
import { ParcelDetailsSection } from "@/features/bookings/components/ParcelDetailsSection";
import { useExpandedBooking } from "@/features/bookings/hooks/useExpandedBooking";
import { createBookingActions } from "@/features/bookings/lib/bookingActions";
import { FILTERS, getRole } from "@/features/bookings/lib/bookingDisplay";
import { getBookingGates } from "@/features/bookings/lib/bookingGates";
import type { Nav, Route } from "@/features/bookings/lib/navigation";

// ExpandedBody and BookingRow stay in this file on purpose: `npm run check:ux`
// pins the "Receiver" party label and the step 5 delivery copy to
// BookingsScreen.tsx. Their state, actions, gates and the sections that are not
// pinned live in ./hooks, ./lib and ./components.

// ─────────────── Expanded section (mirrors web's expanded card body) ───────────────

interface ExpandedBodyProps {
  bookingId: string;
  role: "sender" | "carrier" | "unknown";
  onNavigateRate: (bookingId: string) => void;
  onNavigatePay: (bookingId: string) => void;
}

function ExpandedBody({
  bookingId,
  role,
  onNavigateRate,
  onNavigatePay,
}: Readonly<ExpandedBodyProps>) {
  const {
    booking, timeline, error, refetch, actionPending, cancelOpen, setCancelOpen, acceptHandoffOpen,
    setAcceptHandoffOpen, rejectHandoffOpen, setRejectHandoffOpen, cancelPostPossessionOpen,
    setCancelPostPossessionOpen, modalError, setModalError, otpCode, setOtpCode, generatedOtp,
    setGeneratedOtp, otpEmailed, setOtpEmailed, actionBanner, dismissBanner, showBanner, runAction,
  } = useExpandedBooking(bookingId);

  if (!booking && !error) {
    return (
      <View style={styles.expandedLoading}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (error && !booking) {
    return <ErrorState error={error} subject="this booking" onRetry={() => void refetch()} />;
  }

  if (!booking) {
    return (
      <View style={styles.expandedError}>
        <Text style={styles.expandedErrorText}>Booking unavailable</Text>
      </View>
    );
  }

  const {
    handleSetHandoffPlan, handleMarkHandoffSent, handleSetReturnResolution, handleCompleteReturn,
    handleConfirmReturnReceived, handleConfirmReady, handleStartJourney, handleMarkLanded,
    handleReportDelay, handleAcceptHandoff, handleRejectHandoffConfirm, handleCancelConfirm,
    handleCancelPostPossessionConfirm, handleGenerateOtp, handleCopyOtp, handleConfirmOtp,
  } = createBookingActions({
    booking, bookingId, runAction, showBanner, otpCode, generatedOtp, setOtpCode,
    setGeneratedOtp, setOtpEmailed, setModalError, setAcceptHandoffOpen, setRejectHandoffOpen,
    setCancelOpen, setCancelPostPossessionOpen,
  });

  const {
    isAwaitingHandoff, canPay, canCancel, canAcceptHandoff, canRejectHandoff, handoffDispatched,
    rejectHandoffLabel, canGenerateOtp, canConfirmOtp, canCancelPostPossession, canConfirmReady,
    canStartJourney, canMarkLanded, canReportDelay, awaitingSenderPayment, canRate, hasRated,
    originCity, destinationCity, isOnlineOrder, returnEligible,
  } = getBookingGates(booking, role);

  return (
    <View style={styles.expandedRoot}>
      {actionBanner ? (
        <FormBanner
          variant={actionBanner.variant}
          title={actionBanner.title ?? null}
          message={actionBanner.message ?? null}
          onDismiss={dismissBanner}
        />
      ) : null}

      {/* Parcel details */}
      {booking.parcel ? <ParcelDetailsSection booking={booking} /> : null}

      {/* Receiver / Carrier */}
      {/* `booking.sender` owns the parcel: they hand it to the carrier at step 1 and take
          it back at step 6, where they inspect it and give the carrier the delivery code.
          There is no separate receiver on a booking, so this names them by the role that
          matters at delivery. Kept in step with the web card. */}
      {(booking.sender || booking.carrier) ? (
        <View style={styles.partiesRow}>
          {booking.sender ? (
            <View style={styles.partyItem}>
              <Avatar name={booking.sender.name} uri={booking.sender.avatar_url} size={36} />
              <View style={{ minWidth: 0, flex: 1 }}>
                <Text style={styles.partyKey}>Receiver</Text>
                <Text style={styles.partyValue} numberOfLines={2}>
                  {booking.sender.name}
                </Text>
              </View>
            </View>
          ) : null}
          {booking.carrier ? (
            <View style={styles.partyItem}>
              <Avatar name={booking.carrier.name} uri={booking.carrier.avatar_url} size={36} />
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
      {timeline && timeline.length > 0 ? <BookingTimeline timeline={timeline} /> : null}

      {/* One authoritative position for the whole booking. The action cards below
          can appear out of order (the delivery card is available during transit on
          purpose), so without this the user saw two cards each claiming to be the
          current step. Hidden once the deal is dead - there is no journey left. */}
      {!["cancelled", "cancelled_post_possession", "handoff_rejected", "expired_unpaid", "disputed"].includes(
        booking.status,
      ) ? (
        <JourneyProgress booking={booking} />
      ) : null}

      {/* Action buttons */}
      <View style={styles.actionsWrap}>
        {canPay ? (
          <Pressable
            style={[sharedStyles.actionButton, sharedStyles.actionPrimary, sharedStyles.fullWidthAction]}
            onPress={() => onNavigatePay(booking.id)}
            accessibilityRole="button"
            accessibilityLabel="Pay now"
          >
            <Ionicons name="card" size={14} color={colors.white} />
            {/* The TOTAL the card is charged (fee + platform fee) in the deal's
                currency — the same figure checkout shows. */}
            <Text style={sharedStyles.actionPrimaryText}>
              Pay now · {formatMoney(feeBreakdown(bookingFee(booking)).total, booking.parcel?.fee_currency)}
            </Text>
          </Pressable>
        ) : null}

        {/* A declined / mid-trip-cancelled deal is not finished while the parcel
            is still with the carrier. Rendered first: getting a real parcel home
            outranks anything else left on the card. */}
        {booking.return_plan ? (
          <ParcelReturnCard
            booking={booking}
            role={role}
            pending={
              actionPending === "set-return-resolution" ||
              actionPending === "complete-return" ||
              actionPending === "confirm-return-received"
                ? actionPending
                : null
            }
            onConfirmReturnReceived={handleConfirmReturnReceived}
            onSetResolution={(args) => void handleSetReturnResolution(args)}
            onCompleteReturn={(args) => void handleCompleteReturn(args)}
          />
        ) : null}

        {/* The carrier has the parcel but has not been paid. Nothing has been
            charged yet, so this is a nudge, not a warning - the money only
            becomes urgent once the grace period starts. */}
        {awaitingSenderPayment ? (
          <AwaitingPaymentNotice />
        ) : null}

        {/* Stages 8/9/10 - ready to travel, start the journey, landed. Plus
            Report Delay, which reschedules rather than sending the parcel home. */}
        {canConfirmReady || canStartJourney || canMarkLanded || canReportDelay ? (
          <JourneyActionsCard
            booking={booking}
            pending={
              actionPending === "confirm-ready" ||
              actionPending === "start-journey" ||
              actionPending === "mark-landed" ||
              actionPending === "report-delay"
                ? actionPending
                : null
            }
            onConfirmReady={() => void handleConfirmReady()}
            onStartJourney={() => void handleStartJourney()}
            onMarkLanded={() => void handleMarkLanded()}
            onReportDelay={(args) => void handleReportDelay(args)}
          />
        ) : null}

        {/* Phase 1 sub-steps: coordinate -> send -> inspect. The card below keeps
            accept/decline available throughout, so a carrier who already has the
            parcel is never blocked by an unfinished sub-step. */}
        {isAwaitingHandoff ? (
          <HandoffPlanCard
            booking={booking}
            role={role}
            pending={
              actionPending === "set-handoff-plan" || actionPending === "mark-handoff-sent"
                ? actionPending
                : null
            }
            onSubmitPlan={(plan) => void handleSetHandoffPlan(plan)}
            onMarkSent={(args) => void handleMarkHandoffSent(args)}
          />
        ) : null}

        {/* PHASE 1 of 3 — Handoff: the parcel reaches the CARRIER in the origin
            city, either couriered to their local address (the norm for an online
            order) or handed over in person. They inspect it, then accept or
            decline. No code exists at this phase; the receiver produces one at
            the destination in phase 3. Both sub-steps are spelled out because
            neither was prompted anywhere before. */}
        {canAcceptHandoff ? (
          <AcceptHandoffStep
            booking={booking}
            originCity={originCity}
            isOnlineOrder={isOnlineOrder}
            actionPending={actionPending}
            setAcceptHandoffOpen={setAcceptHandoffOpen}
            canRejectHandoff={canRejectHandoff}
            setRejectHandoffOpen={setRejectHandoffOpen}
            rejectHandoffLabel={rejectHandoffLabel}
            handoffDispatched={handoffDispatched}
            returnEligible={returnEligible}
          />
        ) : null}

        {canCancel && !canAcceptHandoff ? (
          <Pressable
            style={[sharedStyles.actionButton, sharedStyles.actionDanger]}
            onPress={() => setCancelOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Cancel Booking"
          >
            <Ionicons name="ban" size={14} color={colors.danger} />
            <Text style={sharedStyles.actionDangerText}>Cancel Booking</Text>
          </Pressable>
        ) : null}

        {canGenerateOtp ? (
          <View style={sharedStyles.fullWidthAction}>
            <View style={sharedStyles.stepCardHeader}>
              <Ionicons name="key-outline" size={14} color={colors.safe} />
              <Text style={sharedStyles.stepCardEyebrowSafe}>{journeyStepShort(currentJourneyStep(booking))}</Text>
            </View>
            <Text style={sharedStyles.stepCardBody}>
              Your carrier has landed
              {destinationCity ? ` in ${destinationCity}` : " at the destination"}. Agree
              the meetup point or address in chat, then receive and inspect your parcel.
              If everything is good, generate the code and give it to the carrier. This
              will mark the delivery as complete and both the users will be able to rate
              each other.
            </Text>
            <DeliveryCodePanel
              generatedOtp={generatedOtp}
              otpEmailed={otpEmailed}
              handleCopyOtp={handleCopyOtp}
              handleGenerateOtp={handleGenerateOtp}
              actionPending={actionPending}
            />
          </View>
        ) : null}

        {/* PHASE 3 of 3 — Delivery. The code belongs to the RECEIVER at the
            destination. A bare input here read as "a code is required right now",
            which is what made handoff and delivery look like the same step. */}
        {canConfirmOtp ? (
          <ConfirmDeliveryStep
            booking={booking}
            otpCode={otpCode}
            setOtpCode={setOtpCode}
            handleConfirmOtp={handleConfirmOtp}
            actionPending={actionPending}
          />
        ) : null}

        {canCancelPostPossession ? (
          <Pressable
            style={[sharedStyles.actionButton, sharedStyles.actionDanger, sharedStyles.fullWidthAction]}
            onPress={() => setCancelPostPossessionOpen(true)}
            disabled={actionPending !== null}
            accessibilityRole="button"
            accessibilityLabel="Cancel mid-trip"
          >
            <Ionicons name="alert-circle-outline" size={14} color={colors.danger} />
            <Text style={sharedStyles.actionDangerText}>Cancel mid-trip</Text>
          </Pressable>
        ) : null}

        {canRate ? (
          <Pressable
            style={[sharedStyles.actionButton, styles.actionWarning]}
            onPress={() => onNavigateRate(booking.id)}
            accessibilityRole="button"
            accessibilityLabel="Rate Delivery"
          >
            <Ionicons name="star" size={14} color={colors.warning} />
            <Text style={styles.actionWarningText}>Rate Delivery</Text>
          </Pressable>
        ) : null}

        {hasRated ? (
          <View style={[sharedStyles.actionButton, styles.actionRated]}>
            <Ionicons name="star" size={14} color={colors.safe} />
            <Text style={styles.actionRatedText}>You rated this delivery</Text>
          </View>
        ) : null}
      </View>

      <ExpandedBookingModals
        booking={booking}
        actionPending={actionPending}
        modalError={modalError}
        setModalError={setModalError}
        cancelOpen={cancelOpen}
        setCancelOpen={setCancelOpen}
        handleCancelConfirm={handleCancelConfirm}
        acceptHandoffOpen={acceptHandoffOpen}
        setAcceptHandoffOpen={setAcceptHandoffOpen}
        handleAcceptHandoff={handleAcceptHandoff}
        rejectHandoffOpen={rejectHandoffOpen}
        setRejectHandoffOpen={setRejectHandoffOpen}
        handleRejectHandoffConfirm={handleRejectHandoffConfirm}
        cancelPostPossessionOpen={cancelPostPossessionOpen}
        setCancelPostPossessionOpen={setCancelPostPossessionOpen}
        handleCancelPostPossessionConfirm={handleCancelPostPossessionConfirm}
        returnEligible={returnEligible}
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
  onNavigatePay: (bookingId: string) => void;
}

function BookingRow({
  booking,
  role,
  expanded,
  onToggle,
  onNavigateRate,
  onNavigatePay,
}: Readonly<BookingRowProps>) {
  return (
    <Card style={styles.bookingCard}>
      <BookingRowSummary booking={booking} role={role} expanded={expanded} onToggle={onToggle} />

      {expanded ? (
        <View style={styles.expandedDivider}>
          <ExpandedBody
            bookingId={booking.id}
            role={role}
            onNavigateRate={onNavigateRate}
            onNavigatePay={onNavigatePay}
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
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const status = FILTERS[filterIdx]?.status;
  const { bookings, loading, loadingMore, hasMore, error, refetch, loadMore } = useBookings({
    status,
  });

  // Web parity: debounce the client-side search 300ms so filtering doesn't run
  // on every keystroke.
  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(id);
  }, [search]);

  // A deep link (notification, "Go to booking", "Cancel the booking first") opens
  // THAT booking: shown first and expanded. It used to expand only when the booking
  // happened to be on the loaded page, so anyone with more than a page of bookings
  // landed on the list with nothing opened and could not tell which one was meant
  // (client, 26 Oct 2026). Not on the page -> fetched by id.
  const expandId = route.params?.expandId;
  const [fetchedTarget, setFetchedTarget] = useState<Booking | null>(null);
  // Opened once per link: a refetch must not re-open a booking the user closed.
  const expandedFor = useRef<string | null>(null);
  useEffect(() => {
    if (!expandId) return;
    if (expandedFor.current !== expandId) {
      expandedFor.current = expandId;
      setExpandedId(expandId);
    }
    if (bookings.some((b) => b.id === expandId)) return;
    let cancelled = false;
    void bookingsApi.getById(expandId)
      .then((res) => { if (!cancelled && res.data?.booking) setFetchedTarget(res.data.booking as Booking); })
      .catch(() => { /* not yours or gone: the list stays as it is */ });
    return () => { cancelled = true; };
  }, [expandId, bookings]);
  const target = expandId
    ? bookings.find((b) => b.id === expandId) ?? (fetchedTarget?.id === expandId ? fetchedTarget : null)
    : null;

  const filtered = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    // The deep-linked booking leads the list (once), whatever page it is on.
    const list = target ? [target, ...bookings.filter((b) => b.id !== target.id)] : bookings;
    if (!q) return list;
    return list.filter(
      (b) =>
        b.id.toLowerCase().includes(q) ||
        b.parcel?.from_city?.toLowerCase().includes(q) ||
        b.parcel?.to_city?.toLowerCase().includes(q),
    );
  }, [bookings, debouncedSearch, target]);

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

  const handleNavigatePay = useCallback(
    (id: string) => navigation.navigate("PayBookingTab", { bookingId: id }),
    [navigation],
  );

  const keyExtractor = useCallback((b: Booking) => b.id, []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<Booking>) => (
      <BookingRow
        booking={item}
        role={getRole(item, userId)}
        expanded={expandedId === item.id}
        onToggle={() => handleToggle(item.id)}
        onNavigateRate={handleNavigateRate}
        onNavigatePay={handleNavigatePay}
      />
    ),
    [userId, expandedId, handleToggle, handleNavigateRate, handleNavigatePay],
  );

  // Loading / error / empty all render through ListEmptyComponent so the fixed
  // header + filters stay put and only the list body swaps.
  const listEmpty = useMemo(() => {
    if (loading && bookings.length === 0) {
      return <ListSkeleton />;
    }
    if (error && bookings.length === 0) {
      // `error.message` was once rendered raw here and put
      // `column reference "booking_id" is ambiguous ... SQLSTATE 42702` on screen.
      // ErrorState routes every message through the same scrubber, so that cannot
      // come back, and the heading now names the actual failure.
      return <ErrorState error={error} subject="your bookings" onRetry={() => void refetch()} style={styles.errorCard} />;
    }
    return <BookingsEmptyCard filterIdx={filterIdx} navigation={navigation} />;
  }, [loading, error, bookings.length, filterIdx, refetch, navigation]);

  return (
    <Screen scroll={false}>
      <View style={styles.page}>
        {/* Fixed header */}
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

        {/* List (infinite scroll) */}
        <FlatList
          data={filtered}
          style={styles.list}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          ListEmptyComponent={listEmpty}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.footerLoading}>
                <ActivityIndicator size="small" color={colors.primary} />
              </View>
            ) : null
          }
          onEndReached={() => {
            if (hasMore) void loadMore();
          }}
          onEndReachedThreshold={0.4}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={
            filtered.length === 0 ? styles.listContentEmpty : styles.listContent
          }
          refreshControl={
            <RefreshControl
              refreshing={loading && bookings.length > 0}
              onRefresh={refetch}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          }
        />
      </View>
    </Screen>
  );
}
