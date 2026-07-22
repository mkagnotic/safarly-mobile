import { memo, useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { CompositeNavigationProp, useNavigation } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { FormBanner } from "@/components/ui/FormBanner";
import { PrimaryHeaderActions } from "@/components/ui/PrimaryHeaderActions";
import { Screen } from "@/components/ui/Screen";
import { SkeletonBlock } from "@/components/ui/SkeletonBlock";
import { showAppAlert } from "@/feedback/appFeedback";
import { ANY_CITY } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import {
  EditBuddyListingModal,
  type EditBuddyListingFormValues,
} from "@/features/buddies/EditBuddyListingModal";
import { RateBuddyModal, type RateBuddyValues } from "@/features/buddies/RateBuddyModal";
import {
  EditParcelModal,
  type EditParcelFormValues,
} from "@/features/parcels/EditParcelModal";
import { BuddyPartnerCard } from "@/features/travels/BuddyPartnerCard";
import { isTerminal } from "@/features/travels/statusLabels";
import { MatchesModal, type MatchesSource } from "@/features/travels/MatchesModal";
import { JourneySummaryRow } from "@/features/travels/ParcelJourneyTracker";
import { createTrackerBookingResolver } from "@/features/travels/trackerBooking";
import { TravelCard } from "@/features/travels/TravelCard";
import { EditTripModal, type EditTripFormValues } from "@/features/trips/EditTripModal";
import { useBookings } from "@/hooks/api/useBookings";
import { useBuddyConnections } from "@/hooks/api/useBuddyConnections";
import { useBuddyListings } from "@/hooks/api/useBuddyListings";
import { useBuddyRequests } from "@/hooks/api/useBuddyRequests";
import { useMyProfile } from "@/hooks/api/useMyProfile";
import { useParcels } from "@/hooks/api/useParcels";
import { useTrips } from "@/hooks/api/useTrips";
import { MainTabParamList, RootStackParamList } from "@/navigation/types";
import {
  buddiesApi,
  getErrorMessage,
  messagesApi,
  parcelsApi,
  ratingsApi,
  tripsApi,
  type Booking,
  type BuddyConnection,
  type BuddyListing,
  type BuddyRequest,
  type Parcel,
  type Trip,
} from "@/services/api";
import { colors, primaryTint } from "@/theme/colors";

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

/**
 * Keep the first item for each key — guards lists against duplicate rows
 * (e.g. a buddy connection that exists twice for the same pair).
 * Web parity (`CustomerMyTrips.tsx` uniqueBy).
 */
function uniqueBy<T>(items: T[], keyOf: (item: T) => string | undefined): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (!key) return true; // no usable key — leave it in rather than drop silently
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
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
  const delivered = useBookings({ status: "delivered", perPage: 50 });
  const myProfile = useMyProfile();
  const requests = useBuddyRequests();
  const connections = useBuddyConnections();

  // Bookings where I'm the sender — drives the Receive-card journey tracker.
  // Fetched broadly (all statuses) so we can pick the live booking per parcel;
  // the list carries status + timestamps + timeline. Web parity.
  const senderBookings = useBookings({ role: "sender", perPage: 100 });

  // Dedupe every list defensively so a repeated row never renders twice. Most
  // lists are keyed by row id; buddy connections collapse by the *buddy's* id
  // because a pair can end up with more than one active connection row.
  const dedupedSend = uniqueBy(sendParcels.parcels, (p) => p.id);
  const dedupedReceive = uniqueBy(receiveParcels.parcels, (p) => p.id);
  const dedupedConnections = uniqueBy(connections.connections, (c) => c.buddy?.id ?? c.id);
  const dedupedRequests = uniqueBy(requests.requests, (r) => r.id);
  const dedupedListings = uniqueBy(partners.listings, (b) => b.id);
  const dedupedFlights = uniqueBy(flights.trips, (t) => t.id);
  const dedupedArchive = uniqueBy(archive.trips, (t) => t.id);
  const dedupedDelivered = uniqueBy(delivered.bookings, (b) => b.id);

  // Terminal parcels move to Archive, not the active Send/Receive lists (§3.3 / §10.1).
  const activeSend = dedupedSend.filter((p) => !isTerminal(p.status));
  const activeReceive = dedupedReceive.filter((p) => !isTerminal(p.status));

  // In-progress buddies stay in Partners; ratable ones move to Archive (§3.3 / §7.2).
  const activeBuddies = dedupedConnections.filter((c) => !(c.can_rate || c.already_rated));
  const completedBuddies = dedupedConnections.filter((c) => c.can_rate || c.already_rated);

  /** Resolves each parcel to the booking that best represents its journey. */
  const trackerBookingFor = useMemo(
    () => createTrackerBookingResolver(senderBookings.bookings, myProfile.profile?.id),
    [senderBookings.bookings, myProfile.profile?.id],
  );

  // Parcels already carry resolved sender/carrier profiles; reuse them to label
  // archived deliveries (the bookings list join is a deploy-dependent fallback).
  const parcelById = useMemo(() => {
    const map = new Map<string, Parcel>();
    for (const p of dedupedSend) map.set(p.id, p);
    for (const p of dedupedReceive) map.set(p.id, p);
    return map;
  }, [dedupedSend, dedupedReceive]);

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [editParcelPending, setEditParcelPending] = useState(false);
  const [editingBuddy, setEditingBuddy] = useState<BuddyListing | null>(null);
  const [editBuddyPending, setEditBuddyPending] = useState(false);
  const [ratingConn, setRatingConn] = useState<BuddyConnection | null>(null);
  const [ratePending, setRatePending] = useState(false);
  const [matchSource, setMatchSource] = useState<MatchesSource | null>(null);
  const [chatPendingId, setChatPendingId] = useState<string | null>(null);

  const handleViewTripMatches = useCallback(
    (trip: Trip) =>
      setMatchSource({
        kind: "trip",
        id: trip.id,
        routeLabel: `${trip.from_city} → ${trip.to_city}`,
      }),
    [],
  );
  const handleViewParcelMatches = useCallback(
    (parcel: Parcel) =>
      setMatchSource({
        kind: "parcel",
        id: parcel.id,
        routeLabel: `${parcel.from_city} → ${parcel.to_city}`,
      }),
    [],
  );

  const tabs: readonly TabConfig[] = [
    { key: "flights", label: "Flights", count: flights.total },
    {
      key: "packages",
      label: "Packages",
      count: activeSend.length + activeReceive.length,
    },
    { key: "partners", label: "Partners", count: partners.total },
    {
      key: "archive",
      label: "Archive",
      count: archive.total + delivered.bookings.length + completedBuddies.length,
    },
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
      // senderBookings drives the journey trackers on the Receive cards, so it
      // has to refresh with them or the timeline goes stale after a pull.
      await Promise.all([
        sendParcels.refetch(),
        receiveParcels.refetch(),
        senderBookings.refetch(),
      ]);
      return;
    }
    if (activeTab === "partners") {
      await Promise.all([partners.refetch(), requests.refetch(), connections.refetch()]);
      return;
    }
    if (activeTab === "archive") {
      await Promise.all([archive.refetch(), delivered.refetch(), connections.refetch()]);
      return;
    }
  }, [
    activeTab,
    flights,
    sendParcels,
    receiveParcels,
    partners,
    archive,
    delivered,
    requests,
    connections,
    senderBookings,
  ]);

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
  const handleEditBuddy = useCallback((listing: BuddyListing) => {
    setFormError(null);
    setEditingBuddy(listing);
  }, []);
  const handleEditBuddyCancel = useCallback(() => {
    if (!editBuddyPending) setEditingBuddy(null);
  }, [editBuddyPending]);
  const handleOpenBuddy = useCallback(
    (id: string) => navigation.navigate("PartnerDetailsTab", { listingId: id }),
    [navigation],
  );

  const handleEditBuddySubmit = useCallback(
    async (values: EditBuddyListingFormValues) => {
      if (!editingBuddy) return;

      // The modal validates before calling this, so every field is present and
      // in range by now. buddy-handler PUT is still a full upsert — anything
      // omitted here gets nulled — so the payload must stay exhaustive.
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

      setEditBuddyPending(true);
      try {
        await buddiesApi.update(editingBuddy.id, payload);
        await partners.refetch();
        setEditingBuddy(null);
      } catch (err) {
        setFormError(`Couldn't update listing. ${getErrorMessage(err)}`);
      } finally {
        setEditBuddyPending(false);
      }
    },
    [editingBuddy, partners],
  );

  const handleEditParcel = useCallback((parcel: Parcel) => {
    setFormError(null);
    setEditingParcel(parcel);
  }, []);
  const handleEditParcelCancel = useCallback(() => {
    if (!editParcelPending) setEditingParcel(null);
  }, [editParcelPending]);

  const handleEditParcelSubmit = useCallback(
    async (values: EditParcelFormValues) => {
      if (!editingParcel) return;
      const data: Parameters<typeof parcelsApi.update>[1] = {};

      if (!values.from_city) {
        setFormError("Select an origin city to update this parcel.");
        return;
      }
      if (!values.to_city) {
        setFormError("Select a destination city to update this parcel.");
        return;
      }
      const fromCity = values.from_city === ANY_CITY ? "Any" : values.from_city;
      const toCity = values.to_city === ANY_CITY ? "Any" : values.to_city;
      const curFromCity = editingParcel.any_from ? "Any" : editingParcel.from_city;
      const curToCity = editingParcel.any_to ? "Any" : editingParcel.to_city;
      const curFromCountry = (editingParcel.from_country ?? "").toUpperCase() === "US" ? "US" : "IN";
      const curToCountry = (editingParcel.to_country ?? "").toUpperCase() === "US" ? "US" : "IN";
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
        weightNum !== editingParcel.weight_kg
      ) {
        data.weight_kg = weightNum;
      }
      if (values.description !== (editingParcel.description ?? "")) {
        data.description = values.description;
      }
      if (values.category && values.category !== editingParcel.category) {
        data.category = values.category;
      }
      const feeNum = Number(values.fee_offered);
      if (
        values.fee_offered !== "" &&
        Number.isFinite(feeNum) &&
        feeNum !== editingParcel.fee_offered
      ) {
        data.fee_offered = feeNum;
      }
      if (values.fee_currency !== editingParcel.fee_currency) {
        data.fee_currency = values.fee_currency;
      }

      // Dates travel as a set — see ParcelDetailsScreen: the PUT handler does
      // not default delivery_date_mode, so a date change without it can leave
      // mode="single" with from != to.
      const curFrom = editingParcel.delivery_by_from ?? editingParcel.delivery_by ?? "";
      const curTo = editingParcel.delivery_by_to ?? editingParcel.delivery_by ?? "";
      const curMode = editingParcel.delivery_date_mode === "range" ? "range" : "single";
      if (
        values.delivery_by_from !== curFrom ||
        values.delivery_by_to !== curTo ||
        values.delivery_date_mode !== curMode
      ) {
        data.delivery_date_mode = values.delivery_date_mode;
        data.delivery_by_from = values.delivery_by_from;
        data.delivery_by_to = values.delivery_by_to;
        data.delivery_by = values.delivery_by_to;
      }

      if (Object.keys(data).length === 0) {
        setEditingParcel(null);
        return;
      }

      setEditParcelPending(true);
      try {
        await parcelsApi.update(editingParcel.id, data);
        // The parcel lives in either Send or Receive — refresh both.
        await Promise.all([sendParcels.refetch(), receiveParcels.refetch()]);
        setEditingParcel(null);
      } catch (err) {
        setFormError(`Couldn't update parcel. ${getErrorMessage(err)}`);
      } finally {
        setEditParcelPending(false);
      }
    },
    [editingParcel, sendParcels, receiveParcels],
  );

  const handleEditTrip = useCallback((trip: Trip) => {
    setFormError(null);
    setEditingTrip(trip);
  }, []);

  const handleEditTripCancel = useCallback(() => {
    if (!editPending) setEditingTrip(null);
  }, [editPending]);

  const handleEditTripSubmit = useCallback(
    async (values: EditTripFormValues) => {
      if (!editingTrip) return;
      const data: Parameters<typeof tripsApi.update>[1] = {};

      if (!values.from_city) {
        setFormError("Select a departure city to update this trip.");
        return;
      }
      if (!values.to_city) {
        setFormError("Select an arrival city to update this trip.");
        return;
      }
      const fromCity = values.from_city === ANY_CITY ? "Any" : values.from_city;
      const toCity = values.to_city === ANY_CITY ? "Any" : values.to_city;
      const curFromCity = editingTrip.any_from ? "Any" : editingTrip.from_city;
      const curToCity = editingTrip.any_to ? "Any" : editingTrip.to_city;
      const curFromCountry = (editingTrip.from_country ?? "").toUpperCase() === "US" ? "US" : "IN";
      const curToCountry = (editingTrip.to_country ?? "").toUpperCase() === "US" ? "US" : "IN";
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

      const from = values.travel_date_from;
      const to = values.travel_date_to || from; // empty Return ⇒ single date
      if (
        from &&
        (from !== editingTrip.travel_date_from ||
          to !== editingTrip.travel_date_to ||
          from !== editingTrip.travel_date)
      ) {
        data.travel_date = from;
        data.travel_date_from = from;
        data.travel_date_to = to;
      }
      const capacityNum = Number(values.luggage_capacity_kg);
      if (
        values.luggage_capacity_kg !== "" &&
        Number.isFinite(capacityNum) &&
        capacityNum !== editingTrip.luggage_capacity_kg
      ) {
        data.luggage_capacity_kg = capacityNum;
      }
      if (values.notes !== (editingTrip.notes ?? "")) {
        data.notes = values.notes;
      }

      if (Object.keys(data).length === 0) {
        setEditingTrip(null);
        return;
      }

      setEditPending(true);
      try {
        await tripsApi.update(editingTrip.id, data);
        await flights.refetch();
        setEditingTrip(null);
      } catch (err) {
        setFormError(`Couldn't update trip. ${getErrorMessage(err)}`);
      } finally {
        setEditPending(false);
      }
    },
    [editingTrip, flights],
  );

  const refreshing =
    (activeTab === "flights" && flights.loading && flights.trips.length > 0) ||
    (activeTab === "packages" &&
      ((sendParcels.loading && sendParcels.parcels.length > 0) ||
        (receiveParcels.loading && receiveParcels.parcels.length > 0))) ||
    (activeTab === "partners" &&
      ((partners.loading && partners.listings.length > 0) ||
        (connections.loading && connections.connections.length > 0))) ||
    (activeTab === "archive" &&
      ((archive.loading && archive.trips.length > 0) ||
        (delivered.loading && delivered.bookings.length > 0) ||
        (connections.loading && completedBuddies.length > 0)));

  const handleRateDelivery = useCallback(
    (bookingId: string) => navigation.navigate("DeliveryReviewTab", { bookingId }),
    [navigation],
  );

  const handleOpenDelivery = useCallback(
    (bookingId: string) => navigation.navigate("DeliveryDetailsTab", { bookingId }),
    [navigation],
  );

  const handleAcceptRequest = useCallback(
    async (id: string) => {
      setActioningId(id);
      setFormError(null);
      try {
        await buddiesApi.acceptRequest(id);
        await Promise.all([requests.refetch(), connections.refetch()]);
      } catch (err) {
        setFormError(`Couldn't accept request. ${getErrorMessage(err)}`);
      } finally {
        setActioningId(null);
      }
    },
    [requests, connections],
  );

  const handleRejectRequest = useCallback(
    async (id: string) => {
      setActioningId(id);
      setFormError(null);
      try {
        await buddiesApi.rejectRequest(id);
        await requests.refetch();
      } catch (err) {
        setFormError(`Couldn't reject request. ${getErrorMessage(err)}`);
      } finally {
        setActioningId(null);
      }
    },
    [requests],
  );

  const handleCompleteConnection = useCallback(
    async (id: string) => {
      setActioningId(id);
      setFormError(null);
      try {
        await buddiesApi.completeConnection(id);
        await connections.refetch();
      } catch (err) {
        setFormError(`Couldn't confirm the journey. ${getErrorMessage(err)}`);
      } finally {
        setActioningId(null);
      }
    },
    [connections],
  );

  const handleDisconnect = useCallback(
    (conn: BuddyConnection) => {
      showAppAlert({
        title: "Disconnect buddy?",
        message: `${conn.buddy?.name ?? "This buddy"} will be removed from your travel partners. You can reconnect by sending a new request.`,
        actions: [
          { text: "Keep", style: "cancel" },
          {
            text: "Disconnect",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setActioningId(conn.id);
                setFormError(null);
                try {
                  await buddiesApi.disconnect(conn.id);
                  await connections.refetch();
                } catch (err) {
                  setFormError(`Couldn't disconnect. ${getErrorMessage(err)}`);
                } finally {
                  setActioningId(null);
                }
              })();
            },
          },
        ],
      });
    },
    [connections],
  );

  /**
   * Open (or create) the chat with a parcel's matched counterpart — web parity
   * with `TripCard`'s Chat button, which calls `useCreateConversation` and then
   * navigates. The handler is idempotent server-side: one conversation per pair.
   */
  const handleChatCounterpart = useCallback(
    async (parcel: Parcel) => {
      const myId = myProfile.profile?.id;
      const other = myId && parcel.sender_id === myId ? parcel.carrier : parcel.sender;
      if (!other?.id) return;
      setChatPendingId(parcel.id);
      setFormError(null);
      try {
        const res = await messagesApi.createConversation(other.id, "booking");
        const conversationId = res.data?.id;
        if (!conversationId) throw new Error("Conversation could not be opened");
        navigation.navigate("OfferChatTab", {
          conversationId,
          name: other.name ?? "Chat",
          source: "travels",
        });
      } catch (err) {
        setFormError(`Couldn't start chat. ${getErrorMessage(err)}`);
      } finally {
        setChatPendingId(null);
      }
    },
    [myProfile.profile?.id, navigation],
  );

  const handleChatConnection = useCallback(
    (conn: BuddyConnection) => {
      if (!conn.conversation_id) return;
      navigation.navigate("OfferChatTab", {
        conversationId: conn.conversation_id,
        name: conn.buddy?.name ?? "Travel buddy",
        source: "buddies",
      });
    },
    [navigation],
  );

  const handleOpenRate = useCallback((conn: BuddyConnection) => {
    setFormError(null);
    setRatingConn(conn);
  }, []);

  const handleRateCancel = useCallback(() => {
    if (!ratePending) setRatingConn(null);
  }, [ratePending]);

  const handleRateSubmit = useCallback(
    async (values: RateBuddyValues) => {
      if (!ratingConn?.buddy?.id) return;
      setRatePending(true);
      try {
        await ratingsApi.rateBuddy({
          connection_id: ratingConn.id,
          rated_user_id: ratingConn.buddy.id,
          score: values.score,
          review: values.review || undefined,
        });
        await connections.refetch();
        setRatingConn(null);
      } catch (err) {
        setFormError(`Couldn't submit rating. ${getErrorMessage(err)}`);
      } finally {
        setRatePending(false);
      }
    },
    [ratingConn, connections],
  );

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
          <PrimaryHeaderActions />
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
            label="Carry a Parcel"
            variant="secondary"
            onPress={goListTrip}
            style={styles.actionButtonFlex}
          />
          <AppButton
            label="Send a Parcel"
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
            trips={dedupedFlights}
            onRetry={flights.refetch}
            onOpen={handleOpenTrip}
            onEdit={handleEditTrip}
            onDelete={handleDeleteTrip}
            onViewMatches={handleViewTripMatches}
            deletingId={deletingId}
            hasMore={flights.hasMore}
            loadingMore={flights.loadingMore}
            onLoadMore={flights.loadMore}
          />
        ) : null}

        {activeTab === "packages" ? (
          <PackagesTab
            sendLoading={sendParcels.loading}
            sendParcels={activeSend}
            sendError={sendParcels.error}
            receiveLoading={receiveParcels.loading}
            receiveParcels={activeReceive}
            receiveError={receiveParcels.error}
            onOpen={handleOpenParcel}
            onEdit={handleEditParcel}
            onDeleteSend={handleDeleteSendParcel}
            onDeleteReceive={handleDeleteReceiveParcel}
            onViewMatches={handleViewParcelMatches}
            deletingId={deletingId}
            onRetrySend={sendParcels.refetch}
            onRetryReceive={receiveParcels.refetch}
            sendHasMore={sendParcels.hasMore}
            sendLoadingMore={sendParcels.loadingMore}
            onLoadMoreSend={sendParcels.loadMore}
            receiveHasMore={receiveParcels.hasMore}
            receiveLoadingMore={receiveParcels.loadingMore}
            onLoadMoreReceive={receiveParcels.loadMore}
            trackerBookingFor={trackerBookingFor}
            myUserId={myProfile.profile?.id ?? null}
            onChat={(p) => void handleChatCounterpart(p)}
            chatPendingId={chatPendingId}
          />
        ) : null}

        {activeTab === "partners" ? (
          <PartnersTab
            loading={partners.loading}
            error={partners.error}
            listings={dedupedListings}
            onRetry={partners.refetch}
            onOpen={handleOpenBuddy}
            onEdit={handleEditBuddy}
            onDelete={handleDeleteBuddy}
            deletingId={deletingId}
            hasMore={partners.hasMore}
            loadingMore={partners.loadingMore}
            onLoadMore={partners.loadMore}
            requests={dedupedRequests}
            activeBuddies={activeBuddies}
            actioningId={actioningId}
            onAccept={handleAcceptRequest}
            onReject={handleRejectRequest}
            onChat={handleChatConnection}
            onComplete={handleCompleteConnection}
            onDisconnect={handleDisconnect}
          />
        ) : null}

        {activeTab === "archive" ? (
          <ArchiveTab
            loading={archive.loading}
            error={archive.error}
            trips={dedupedArchive}
            onRetry={archive.refetch}
            onOpen={handleOpenTrip}
            deliveredLoading={delivered.loading}
            deliveredBookings={dedupedDelivered}
            myUserId={myProfile.profile?.id ?? null}
            onRateDelivery={handleRateDelivery}
            onOpenDelivery={handleOpenDelivery}
            hasMore={archive.hasMore}
            loadingMore={archive.loadingMore}
            onLoadMore={archive.loadMore}
            completedBuddies={completedBuddies}
            onRateBuddy={handleOpenRate}
            parcelById={parcelById}
          />
        ) : null}
      </ScrollView>

      <MatchesModal
        open={!!matchSource}
        source={matchSource}
        onClose={() => setMatchSource(null)}
      />

      {editingTrip ? (
        <EditTripModal
          open
          initial={{
            from_city: editingTrip.any_from ? ANY_CITY : (editingTrip.from_city ?? ""),
            from_country: (editingTrip.from_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            to_city: editingTrip.any_to ? ANY_CITY : (editingTrip.to_city ?? ""),
            to_country: (editingTrip.to_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            travel_date_from: editingTrip.travel_date_from ?? editingTrip.travel_date ?? "",
            travel_date_to:
              editingTrip.travel_date_to &&
              editingTrip.travel_date_to !== (editingTrip.travel_date_from ?? editingTrip.travel_date)
                ? editingTrip.travel_date_to
                : "",
            luggage_capacity_kg: `${editingTrip.luggage_capacity_kg ?? ""}`,
            notes: editingTrip.notes ?? "",
          }}
          pending={editPending}
          onCancel={handleEditTripCancel}
          onSubmit={handleEditTripSubmit}
        />
      ) : null}

      {ratingConn ? (
        <RateBuddyModal
          open
          buddyName={ratingConn.buddy?.name ?? "your buddy"}
          pending={ratePending}
          onCancel={handleRateCancel}
          onSubmit={handleRateSubmit}
        />
      ) : null}

      {editingParcel ? (
        <EditParcelModal
          open
          initial={{
            from_city: editingParcel.any_from ? ANY_CITY : (editingParcel.from_city ?? ""),
            from_country: (editingParcel.from_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            to_city: editingParcel.any_to ? ANY_CITY : (editingParcel.to_city ?? ""),
            to_country: (editingParcel.to_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            weight_kg: `${editingParcel.weight_kg ?? ""}`,
            description: editingParcel.description ?? "",
            category:
              (editingParcel.category as EditParcelFormValues["category"]) ?? "personal",
            fee_offered: `${editingParcel.fee_offered ?? ""}`,
            fee_currency: editingParcel.fee_currency === "INR" ? "INR" : "USD",
            // Trust the persisted mode rather than inferring it from the dates.
            delivery_by_from:
              editingParcel.delivery_by_from ?? editingParcel.delivery_by ?? "",
            delivery_by_to: editingParcel.delivery_by_to ?? editingParcel.delivery_by ?? "",
            delivery_date_mode:
              editingParcel.delivery_date_mode === "range" ? "range" : "single",
          }}
          pending={editParcelPending}
          onCancel={handleEditParcelCancel}
          onSubmit={handleEditParcelSubmit}
        />
      ) : null}

      {editingBuddy ? (
        <EditBuddyListingModal
          open
          initial={{
            from_city: editingBuddy.from_city === "Any" ? ANY_CITY : editingBuddy.from_city,
            from_country: USA_CITIES.includes(editingBuddy.from_city) ? "US" : "IN",
            to_city: editingBuddy.to_city === "Any" ? ANY_CITY : editingBuddy.to_city,
            to_country: INDIA_CITIES.includes(editingBuddy.to_city) ? "IN" : "US",
            travel_date: editingBuddy.travel_date_from ?? editingBuddy.travel_date ?? "",
            airline: editingBuddy.airline ?? "",
            age: editingBuddy.age != null ? String(editingBuddy.age) : "",
            languages: editingBuddy.languages ?? [],
            interests: editingBuddy.interests ?? "",
            layover: editingBuddy.layover ?? "",
            bio: editingBuddy.bio ?? "",
          }}
          pending={editBuddyPending}
          onCancel={handleEditBuddyCancel}
          onSubmit={handleEditBuddySubmit}
        />
      ) : null}
    </Screen>
  );
}

// ───────────────────────── Tabs control ─────────────────────────

interface TabsProps {
  tabs: readonly TabConfig[];
  active: TabKey;
  onChange: (key: TabKey) => void;
}

/**
 * Scrollable segmented control.
 *
 * Tabs size to their label rather than sharing the width equally: at phone
 * widths four equal columns can't fit "Packages (12)" and the label was being
 * clipped mid-word. Web solves it the same way — its TabsList only becomes a
 * 4-column grid at `sm:` and up, and scrolls horizontally below that
 * (`CustomerMyTrips.tsx` TabsList: `overflow-x-auto ... sm:grid-cols-4`).
 */
const Tabs = memo(function Tabs({ tabs, active, onChange }: Readonly<TabsProps>) {
  return (
    <View style={styles.tabsRow}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabsScrollContent}
        keyboardShouldPersistTaps="handled"
      >
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
              {/* No numberOfLines — the row scrolls, so labels never truncate. */}
              <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                {tab.label}
                {typeof tab.count === "number" ? (
                  <Text style={styles.tabCount}> ({tab.count})</Text>
                ) : null}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>
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
  onEdit,
  onDelete,
  onViewMatches,
  deletingId,
  hasMore,
  loadingMore,
  onLoadMore,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  onEdit: (trip: Trip) => void;
  onDelete: (trip: Trip) => void;
  onViewMatches: (trip: Trip) => void;
  deletingId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
}>) {
  if (loading && trips.length === 0) return <ListSkeleton />;
  if (error && trips.length === 0)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (trips.length === 0)
    return (
      <EmptyBlock
        icon="airplane-outline"
        title="No flights listed"
        subtitle="List a trip to start receiving parcel delivery offers."
      />
    );
  return (
    <View>
      {trips.map((t) => (
        <TravelCard
          key={t.id}
          type="flight"
          tag="TRIP LISTING"
          item={t}
          onPress={() => onOpen(t.id)}
          onEdit={() => onEdit(t)}
          onDelete={() => onDelete(t)}
          onViewMatches={() => onViewMatches(t)}
          isDeleting={deletingId === t.id}
        />
      ))}
      <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
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
  onEdit,
  onDeleteSend,
  onDeleteReceive,
  onViewMatches,
  deletingId,
  onRetrySend,
  onRetryReceive,
  sendHasMore,
  sendLoadingMore,
  onLoadMoreSend,
  receiveHasMore,
  receiveLoadingMore,
  onLoadMoreReceive,
  trackerBookingFor,
  myUserId,
  onChat,
  chatPendingId,
}: Readonly<{
  sendLoading: boolean;
  sendParcels: Parcel[];
  sendError: Error | null;
  receiveLoading: boolean;
  receiveParcels: Parcel[];
  receiveError: Error | null;
  onOpen: (id: string) => void;
  onEdit: (parcel: Parcel) => void;
  onDeleteSend: (parcel: Parcel) => void;
  onDeleteReceive: (parcel: Parcel) => void;
  onViewMatches: (parcel: Parcel) => void;
  deletingId: string | null;
  onRetrySend: () => Promise<void>;
  onRetryReceive: () => Promise<void>;
  sendHasMore: boolean;
  sendLoadingMore: boolean;
  onLoadMoreSend: () => void;
  receiveHasMore: boolean;
  receiveLoadingMore: boolean;
  onLoadMoreReceive: () => void;
  /** Resolves the booking that drives a parcel's journey tracker. */
  trackerBookingFor: (parcel: Parcel) => Booking | null;
  myUserId: string | null;
  onChat: (parcel: Parcel) => void;
  chatPendingId: string | null;
}>) {
  /** The other party on a matched parcel — carrier if I sent it, else the sender. */
  const counterpartOf = (p: Parcel) =>
    (myUserId && p.sender_id === myUserId ? p.carrier : p.sender) ?? null;
  const roleOf = (p: Parcel) => (myUserId && p.sender_id === myUserId ? "carrier" : "sender");

  return (
    <View>
      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.wordmark} />
          <Text style={styles.sectionTitle}>Send</Text>
          <Text style={styles.sectionHint}>(Packages I'm Delivering)</Text>
        </View>
        {sendLoading && sendParcels.length === 0 ? (
          <ListSkeleton count={2} />
        ) : sendError && sendParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(sendError)} onRetry={onRetrySend} />
        ) : sendParcels.length === 0 ? (
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No packages to deliver yet</Text>
          </View>
        ) : (
          sendParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              tag="PACKAGE DELIVERY"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDeleteSend(p)}
              onViewMatches={() => onViewMatches(p)}
              isDeleting={deletingId === p.id}
              counterpart={counterpartOf(p)}
              counterpartRole={roleOf(p)}
              onChat={() => onChat(p)}
              chatPending={chatPendingId === p.id}
            />
          ))
        )}
        <LoadMoreButton
          hasMore={sendHasMore}
          loading={sendLoadingMore}
          onPress={onLoadMoreSend}
        />
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="cube-outline" size={16} color={colors.safe} />
          <Text style={styles.sectionTitle}>Receive</Text>
          <Text style={styles.sectionHint}>(Packages I'm Receiving)</Text>
        </View>
        {receiveLoading && receiveParcels.length === 0 ? (
          <ListSkeleton count={2} />
        ) : receiveError && receiveParcels.length === 0 ? (
          <ErrorBlock message={getErrorMessage(receiveError)} onRetry={onRetryReceive} />
        ) : receiveParcels.length === 0 ? (
          // Matches the Send section above and web's dashed placeholder. The
          // "Send a Parcel" CTA already sits in the header actions row, so
          // repeating it here just pushed a second primary button on-screen.
          <View style={styles.emptyPanel}>
            <Text style={styles.emptyPanelText}>No packages to receive yet</Text>
          </View>
        ) : (
          receiveParcels.map((p) => (
            <TravelCard
              key={p.id}
              type="parcel"
              tag="PARCEL REQUEST"
              item={p}
              onPress={() => onOpen(p.id)}
              onEdit={() => onEdit(p)}
              onDelete={() => onDeleteReceive(p)}
              onViewMatches={() => onViewMatches(p)}
              isDeleting={deletingId === p.id}
              counterpart={counterpartOf(p)}
              counterpartRole={roleOf(p)}
              onChat={() => onChat(p)}
              chatPending={chatPendingId === p.id}
              // Only Receive cards carry journey status — as the sender you're
              // the one following the parcel. The card shows a one-line summary;
              // the full timeline lives on the details screen this card opens.
              footer={<JourneySummaryRow parcel={p} booking={trackerBookingFor(p)} />}
            />
          ))
        )}
        <LoadMoreButton
          hasMore={receiveHasMore}
          loading={receiveLoadingMore}
          onPress={onLoadMoreReceive}
        />
      </View>
    </View>
  );
}

function PartnersTab({
  loading,
  error,
  listings,
  onRetry,
  onOpen,
  onEdit,
  onDelete,
  deletingId,
  hasMore,
  loadingMore,
  onLoadMore,
  requests,
  activeBuddies,
  actioningId,
  onAccept,
  onReject,
  onChat,
  onComplete,
  onDisconnect,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  listings: ReturnType<typeof useBuddyListings>["listings"];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  onEdit: (listing: BuddyListing) => void;
  onDelete: (id: string) => void;
  deletingId: string | null;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  requests: BuddyRequest[];
  activeBuddies: BuddyConnection[];
  actioningId: string | null;
  onAccept: (id: string) => void;
  onReject: (id: string) => void;
  onChat: (conn: BuddyConnection) => void;
  onComplete: (id: string) => void;
  onDisconnect: (conn: BuddyConnection) => void;
}>) {
  const hasExtras = requests.length > 0 || activeBuddies.length > 0;

  const listingsBody =
    loading && listings.length === 0 ? (
      <ListSkeleton />
    ) : error && listings.length === 0 ? (
      <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />
    ) : listings.length === 0 ? (
      <EmptyBlock
        icon="people-outline"
        title="No travel partners"
        subtitle="Create a buddy listing to find travel companions."
      />
    ) : (
      <View>
        {listings.map((b) => (
          <BuddyPartnerCard
            key={b.id}
            item={b}
            onPress={() => onOpen(b.id)}
            onEdit={() => onEdit(b)}
            onDelete={() => onDelete(b.id)}
            isDeleting={deletingId === b.id}
          />
        ))}
        <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
      </View>
    );

  return (
    <View>
      {requests.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Ionicons name="mail-unread-outline" size={16} color={colors.warning} />
            <Text style={styles.sectionTitle}>Requests received</Text>
          </View>
          {requests.map((r) => (
            <BuddyRequestCard
              key={r.id}
              request={r}
              pending={actioningId === r.id}
              onAccept={() => onAccept(r.id)}
              onReject={() => onReject(r.id)}
            />
          ))}
        </View>
      ) : null}

      {activeBuddies.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Ionicons name="people-outline" size={16} color={colors.safe} />
            <Text style={styles.sectionTitle}>My buddies</Text>
          </View>
          {activeBuddies.map((c) => (
            <BuddyConnectionCard
              key={c.id}
              connection={c}
              pending={actioningId === c.id}
              onChat={() => onChat(c)}
              onComplete={() => onComplete(c.id)}
              onDisconnect={() => onDisconnect(c)}
            />
          ))}
        </View>
      ) : null}

      <View style={styles.section}>
        {hasExtras ? (
          <View style={styles.sectionHeading}>
            <Ionicons name="megaphone-outline" size={16} color={colors.wordmark} />
            <Text style={styles.sectionTitle}>My listings</Text>
          </View>
        ) : null}
        {listingsBody}
      </View>
    </View>
  );
}

function BuddyRequestCard({
  request,
  pending,
  onAccept,
  onReject,
}: Readonly<{ request: BuddyRequest; pending: boolean; onAccept: () => void; onReject: () => void }>) {
  const sender = request.requester ?? request.user_profiles ?? null;
  const message = request.message?.trim() || "wants to be your travel buddy";
  return (
    <View style={styles.lcCard}>
      <View style={styles.lcPersonRow}>
        <View style={styles.lcAvatar}>
          <Text style={styles.lcAvatarText}>{getInitials(sender?.name)}</Text>
        </View>
        <View style={styles.lcPersonInfo}>
          <Text style={styles.lcName} numberOfLines={1}>
            {sender?.name || "Someone"}
          </Text>
          <Text style={styles.lcMessage} numberOfLines={2}>
            {message}
          </Text>
        </View>
      </View>
      <View style={styles.lcActions}>
        <AppButton
          label="Decline"
          variant="secondary"
          onPress={onReject}
          disabled={pending}
          style={styles.lcActionFlex}
        />
        <AppButton
          label={pending ? "…" : "Accept"}
          onPress={onAccept}
          disabled={pending}
          gradientColors={[colors.ctaAccent, colors.ctaAccent]}
          style={styles.lcActionFlex}
        />
      </View>
    </View>
  );
}

function BuddyConnectionCard({
  connection,
  pending,
  onChat,
  onComplete,
  onDisconnect,
}: Readonly<{
  connection: BuddyConnection;
  pending: boolean;
  onChat: () => void;
  onComplete: () => void;
  onDisconnect: () => void;
}>) {
  const c = connection;
  const route = c.from_city && c.to_city ? `${c.from_city} → ${c.to_city}` : null;
  const journeyStart = c.travel_date_from || c.travel_date;
  const journeyStarted =
    !journeyStart || journeyStart.slice(0, 10) <= new Date().toLocaleDateString("en-CA");
  return (
    <View style={styles.lcCard}>
      <View style={styles.lcPersonRow}>
        <View style={styles.lcAvatar}>
          <Text style={styles.lcAvatarText}>{getInitials(c.buddy?.name)}</Text>
        </View>
        <View style={styles.lcPersonInfo}>
          <Text style={styles.lcName} numberOfLines={1}>
            {c.buddy?.name || "Travel buddy"}
          </Text>
          {route ? (
            <Text style={styles.lcMessage} numberOfLines={1}>
              {route}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.lcActions}>
        {c.conversation_id ? (
          <AppButton
            label="Chat"
            onPress={onChat}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.lcChatBtn}
          />
        ) : null}
        {c.i_confirmed_completion ? (
          <View style={[styles.lcActionFlex, styles.lcChip]}>
            <Text style={styles.lcChipText}>Awaiting buddy</Text>
          </View>
        ) : journeyStarted ? (
          <AppButton
            label={pending ? "…" : "Confirm journey"}
            onPress={onComplete}
            disabled={pending}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.lcActionFlex}
          />
        ) : (
          <View style={[styles.lcActionFlex, styles.lcChip, styles.lcChipMuted]}>
            <Text style={styles.lcChipMutedText}>Confirm after trip</Text>
          </View>
        )}
      </View>
      <View style={styles.lcDivider} />
      <Pressable
        onPress={onDisconnect}
        disabled={pending}
        style={styles.lcDisconnect}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel="Disconnect buddy"
      >
        <Ionicons name="unlink-outline" size={14} color={colors.danger} />
        <Text style={styles.lcDisconnectText}>Disconnect</Text>
      </Pressable>
    </View>
  );
}

function ArchiveTab({
  loading,
  error,
  trips,
  onRetry,
  onOpen,
  deliveredLoading,
  deliveredBookings,
  myUserId,
  onRateDelivery,
  onOpenDelivery,
  hasMore,
  loadingMore,
  onLoadMore,
  completedBuddies,
  onRateBuddy,
  parcelById,
}: Readonly<{
  loading: boolean;
  error: Error | null;
  trips: Trip[];
  onRetry: () => Promise<void>;
  onOpen: (id: string) => void;
  deliveredLoading: boolean;
  deliveredBookings: Booking[];
  myUserId: string | null;
  onRateDelivery: (bookingId: string) => void;
  onOpenDelivery: (bookingId: string) => void;
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  completedBuddies: BuddyConnection[];
  onRateBuddy: (conn: BuddyConnection) => void;
  /** Parcels already loaded in Send/Receive, keyed by id — feeds the archive tracker. */
  parcelById: Map<string, Parcel>;
}>) {
  const nothing =
    trips.length === 0 && deliveredBookings.length === 0 && completedBuddies.length === 0;
  if ((loading || deliveredLoading) && nothing) return <ListSkeleton />;
  if (error && nothing)
    return <ErrorBlock message={getErrorMessage(error)} onRetry={onRetry} />;
  if (nothing)
    return (
      <EmptyBlock
        icon="archive"
        title="No archived items"
        subtitle="Completed deliveries, trips, and travel partners will appear here."
      />
    );
  return (
    <View>
      {deliveredBookings.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Ionicons name="checkmark-done-outline" size={16} color={colors.safe} />
            <Text style={styles.sectionTitle}>Completed deliveries</Text>
          </View>
          {deliveredBookings.map((b) => (
            <ArchiveBookingCard
              key={b.id}
              booking={b}
              parcel={parcelById.get(b.parcel_id) ?? null}
              myUserId={myUserId}
              onRate={() => onRateDelivery(b.id)}
              onOpen={() => onOpenDelivery(b.id)}
            />
          ))}
        </View>
      ) : null}

      {completedBuddies.length > 0 ? (
        <View style={styles.section}>
          <View style={styles.sectionHeading}>
            <Ionicons name="people-outline" size={16} color={colors.safe} />
            <Text style={styles.sectionTitle}>Completed buddies</Text>
          </View>
          {completedBuddies.map((c) => (
            <ArchiveBuddyCard key={c.id} connection={c} onRate={() => onRateBuddy(c)} />
          ))}
        </View>
      ) : null}

      {trips.length > 0 ? (
        <View style={styles.section}>
          {deliveredBookings.length > 0 ? (
            <View style={styles.sectionHeading}>
              <Ionicons name="airplane-outline" size={16} color={colors.wordmark} />
              <Text style={styles.sectionTitle}>Flights</Text>
            </View>
          ) : null}
          {trips.map((t) => (
            <TravelCard
              key={t.id}
              type="flight"
              // Neutral tag: these are closed records, so the accent orange read
              // as an active listing. The status pill carries the real outcome.
              tag="ARCHIVED TRIP"
              tagTone="muted"
              item={t}
              onPress={() => onOpen(t.id)}
            />
          ))}
          <LoadMoreButton hasMore={hasMore} loading={loadingMore} onPress={onLoadMore} />
        </View>
      ) : null}
    </View>
  );
}

function ArchiveBookingCard({
  booking,
  parcel,
  myUserId,
  onRate,
  onOpen,
}: Readonly<{
  booking: Booking;
  /** Resolved parcel, when loaded — gives the tracker its pre-booking fallback. */
  parcel?: Parcel | null;
  myUserId: string | null;
  onRate: () => void;
  /** Opens the delivery details screen, where the full timeline lives. */
  onOpen: () => void;
}>) {
  const isSender = !!myUserId && booking.sender_id === myUserId;
  const counterpart = isSender ? booking.carrier : booking.sender;
  const roleLabel = isSender ? "Carrier" : "Sender";
  const route = booking.parcel
    ? `${booking.parcel.from_city} → ${booking.parcel.to_city}`
    : "Delivery";
  const deliveredOn = booking.delivered_at
    ? new Date(booking.delivered_at).toLocaleDateString(undefined, {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : null;
  return (
    <Pressable
      style={styles.archiveCard}
      onPress={onOpen}
      accessibilityRole="button"
      accessibilityLabel={`Delivery details: ${route}`}
    >
      <View style={styles.archiveTag}>
        <Text style={styles.archiveTagText}>DELIVERED</Text>
      </View>
      <Text style={styles.archiveRoute} numberOfLines={2}>
        {route}
      </Text>
      {deliveredOn ? (
        <Text style={styles.archiveMeta}>Delivered · {deliveredOn}</Text>
      ) : null}
      <View style={styles.archiveFooter}>
        <View style={styles.archivePersonCol}>
          <Text style={styles.archiveRole}>{roleLabel}</Text>
          <Text style={styles.archivePersonName} numberOfLines={1}>
            {counterpart?.name || "Unknown user"}
          </Text>
        </View>
        {/* Ratings are one-per (author, booking): offering "Rate" again after
            the viewer has rated just fails with CONFLICT. */}
        {booking.viewer_has_rated ? (
          <View style={styles.ratedChip}>
            <Ionicons name="star" size={13} color={colors.safe} />
            <Text style={styles.ratedChipText}>Rated</Text>
          </View>
        ) : (
          <AppButton
            label={`Rate ${roleLabel}`}
            onPress={onRate}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.archiveRateBtn}
          />
        )}
      </View>
      {/* Summary only — the full timeline lives on the details screen. */}
      <JourneySummaryRow parcel={parcel} booking={booking} />
    </Pressable>
  );
}

function ArchiveBuddyCard({
  connection,
  onRate,
}: Readonly<{ connection: BuddyConnection; onRate: () => void }>) {
  const c = connection;
  const route = c.from_city && c.to_city ? `${c.from_city} → ${c.to_city}` : null;
  return (
    <View style={styles.archiveCard}>
      <View style={[styles.archiveTag, styles.archiveTagBuddy]}>
        <Text style={styles.archiveTagText}>TRAVEL BUDDY</Text>
      </View>
      <Text style={styles.archiveRoute} numberOfLines={1}>
        {c.buddy?.name || "Travel buddy"}
      </Text>
      {route ? (
        <Text style={styles.archiveMeta} numberOfLines={1}>
          {route}
        </Text>
      ) : null}
      <View style={styles.archiveFooter}>
        <View style={styles.archivePersonCol} />
        {c.already_rated ? (
          <View style={styles.ratedBadge}>
            <Ionicons name="star" size={12} color={colors.safe} />
            <Text style={styles.ratedBadgeText}>Rated</Text>
          </View>
        ) : (
          <AppButton
            label="Rate buddy"
            onPress={onRate}
            gradientColors={[colors.ctaAccent, colors.ctaAccent]}
            style={styles.archiveRateBtn}
          />
        )}
      </View>
    </View>
  );
}

// ───────────────────────── Reusable bits ─────────────────────────

function getInitials(name?: string | null): string {
  if (!name) return "?";
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function LoadMoreButton({
  hasMore,
  loading,
  onPress,
}: Readonly<{ hasMore: boolean; loading: boolean; onPress: () => void }>) {
  if (!hasMore) return null;
  return (
    <Pressable
      onPress={onPress}
      disabled={loading}
      style={[styles.loadMoreButton, loading && styles.loadMoreDisabled]}
      accessibilityRole="button"
      accessibilityLabel="Load more"
    >
      {loading ? (
        <ActivityIndicator size="small" color={colors.primary} />
      ) : (
        <Text style={styles.loadMoreText}>Load more</Text>
      )}
    </Pressable>
  );
}

function TravelCardSkeleton() {
  return (
    <View style={styles.skeletonCard}>
      <SkeletonBlock style={styles.skeletonTag} />
      <View style={styles.skeletonRouteRow}>
        <View style={styles.skeletonBodyCol}>
          <SkeletonBlock style={styles.skeletonRoute} />
          <SkeletonBlock style={styles.skeletonMeta} />
        </View>
        <View style={styles.skeletonActionsCol}>
          <SkeletonBlock style={styles.skeletonActionButton} />
          <SkeletonBlock style={styles.skeletonActionButton} />
        </View>
      </View>
      <SkeletonBlock style={styles.skeletonStatusPill} />
    </View>
  );
}

function ListSkeleton({ count = 3 }: Readonly<{ count?: number }>) {
  return (
    <View>
      {Array.from({ length: count }).map((_, i) => (
        <TravelCardSkeleton key={i} />
      ))}
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
}

/**
 * Whole-tab empty state.
 *
 * No action button by design: every tab's primary CTA ("Carry a Parcel" /
 * "Send a Parcel") already sits in the header actions row, so repeating it here
 * put two identical primary buttons on one screen.
 */
function EmptyBlock({ icon, title, subtitle }: Readonly<EmptyBlockProps>) {
  return (
    <View style={styles.emptyWrap}>
      <View style={styles.emptyIconBox}>
        <Ionicons name={icon} size={28} color={colors.wordmark} />
      </View>
      <Text style={styles.emptyTitle}>{title}</Text>
      <Text style={styles.emptySubtitle}>{subtitle}</Text>
    </View>
  );
}

// ───────────────────────── Styles ─────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: 20, paddingBottom: 32, paddingTop: 8 },

  headerRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 8, marginBottom: 14 },
  titleBlock: { flex: 1, minWidth: 0 },
  title: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginTop: 4 },
  bannerSlot: { marginBottom: 14 },

  actionsRow: { flexDirection: "row", gap: 10, marginTop: 16, marginBottom: 18 },
  actionButtonFlex: { flex: 1 },

  tabsRow: {
    backgroundColor: colors.surfaceMuted,
    borderRadius: 12,
    padding: 4,
    marginBottom: 16,
  },
  tabsScrollContent: { flexDirection: "row", gap: 4, alignItems: "stretch" },
  tab: {
    // Content-sized, never squeezed — `flex: 1` here is what clipped the labels.
    flexShrink: 0,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tabActive: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  tabText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  tabTextActive: { color: colors.text },
  tabCount: { color: colors.subtleText, fontSize: 12, lineHeight: 16, fontWeight: "600" },

  // Sections within Packages
  section: { marginBottom: 18 },
  sectionHeading: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 10 },
  sectionTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  sectionHint: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500" },
  /**
   * Empty-list panel.
   *
   * Was a dashed hairline in `colors.border` (#EDE6F5) with no fill, which is
   * near-invisible against the peach/lavender hero wash (#ECDBE4) — the box read
   * as floating text. Two changes fix it: an opaque white surface so the panel
   * has an actual edge, and a solid brand-tinted stroke instead of dashed —
   * RN draws `borderStyle: "dashed"` unreliably on Android once `borderRadius`
   * is involved, so the dashes were being dropped on top of the low contrast.
   */
  emptyPanel: {
    paddingVertical: 28,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    backgroundColor: colors.card,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyPanelText: { color: colors.subtleText, fontSize: 13, lineHeight: 18, fontWeight: "500" },

  // Archive — completed delivery card
  archiveCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  archiveTag: {
    alignSelf: "flex-start",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
    marginBottom: 10,
  },
  archiveTagText: {
    color: colors.safe,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.5,
  },
  archiveRoute: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  archiveMeta: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 4 },
  archiveFooter: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
  },
  archivePersonCol: { flex: 1, minWidth: 0 },
  archiveRole: {
    color: colors.subtleText,
    fontSize: 10,
    lineHeight: 14,
    fontWeight: "800",
    letterSpacing: 0.4,
  },
  archivePersonName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: "700", marginTop: 2 },
  archiveRateBtn: { minWidth: 130 },
  ratedChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(34, 195, 93, 0.12)",
  },
  ratedChipText: { color: colors.safe, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  archiveTagBuddy: { backgroundColor: colors.surfaceTintPrimary },
  ratedBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: "rgba(34, 197, 94, 0.12)",
  },
  ratedBadgeText: { color: colors.safe, fontSize: 13, lineHeight: 18, fontWeight: "800" },

  // Buddy request / connection card
  lcCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
    gap: 12,
  },
  lcPersonRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  lcAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  lcAvatarText: { color: colors.wordmark, fontSize: 14, lineHeight: 18, fontWeight: "800" },
  lcPersonInfo: { flex: 1, minWidth: 0 },
  lcName: { color: colors.text, fontSize: 15, lineHeight: 20, fontWeight: "800" },
  lcMessage: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "500", marginTop: 2 },
  lcActions: { flexDirection: "row", alignItems: "center", gap: 10 },
  lcActionFlex: { flex: 1 },
  lcChatBtn: { flex: 1 },
  lcChip: {
    minHeight: 48,
    borderRadius: 16,
    backgroundColor: "rgba(245, 158, 11, 0.12)",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 12,
  },
  lcChipText: { color: colors.warning, fontSize: 13, lineHeight: 18, fontWeight: "800" },
  lcChipMuted: { backgroundColor: colors.surfaceMuted },
  lcChipMutedText: { color: colors.mutedText, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  lcDivider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
  lcDisconnect: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 4,
  },
  lcDisconnectText: { color: colors.danger, fontSize: 13, lineHeight: 18, fontWeight: "700" },

  skeletonCard: {
    padding: 16,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: 12,
  },
  skeletonTag: { width: 110, height: 20, borderRadius: 6, marginBottom: 12 },
  skeletonRouteRow: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  skeletonBodyCol: { flex: 1, minWidth: 0, gap: 8 },
  skeletonRoute: { width: "85%", height: 22, borderRadius: 6 },
  skeletonMeta: { width: "65%", height: 16, borderRadius: 6 },
  skeletonActionsCol: { gap: 8, minWidth: 76 },
  skeletonActionButton: { height: 34, width: 76, borderRadius: 10 },
  skeletonStatusPill: { width: 120, height: 20, borderRadius: 999, marginTop: 12 },

  // Loading / error / empty
  centered: { alignItems: "center", justifyContent: "center", paddingVertical: 40, gap: 10 },
  errorTitle: { color: colors.text, fontSize: 16, lineHeight: 22, fontWeight: "800" },
  errorBody: { color: colors.mutedText, fontSize: 13, lineHeight: 19, fontWeight: "500", textAlign: "center", maxWidth: 280 },
  retryButtonWrap: { marginTop: 4, alignSelf: "stretch", maxWidth: 220 },
  /**
   * Same surface as `emptyPanel` (the Send/Receive placeholders) so every empty
   * state in My Travels reads as one thing. Was transparent, which left the
   * block floating on the hero wash with no visible container.
   */
  emptyWrap: {
    alignItems: "center",
    paddingVertical: 32,
    paddingHorizontal: 20,
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: primaryTint.stroke18,
    backgroundColor: colors.card,
  },
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
});
