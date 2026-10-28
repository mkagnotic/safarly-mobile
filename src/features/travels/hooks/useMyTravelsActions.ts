import { useCallback, useState } from "react";

import { showAppAlert, showToast } from "@/feedback/appFeedback";
import { ANY_CITY } from "@/features/search/CityPicker";
import type { EditBuddyListingFormValues } from "@/features/buddies/EditBuddyListingModal";
import type { RateBuddyValues } from "@/features/buddies/RateBuddyModal";
import type { EditParcelFormValues } from "@/features/parcels/EditParcelModal";
import { returnFormChanges } from "@/utils/addressOptions";
import type { MatchesSource } from "@/features/travels/MatchesModal";
import type { EditTripFormValues } from "@/features/trips/EditTripModal";
import { editTripBuddyMessage } from "@/features/trips/model/openBuddy";
import {
  buddiesApi,
  getErrorMessage,
  messagesApi,
  parcelsApi,
  ratingsApi,
  tripsApi,
  type BuddyConnection,
  type BuddyListing,
  type BuddyRequest,
  type Parcel,
  type Trip,
} from "@/services/api";
import type { MyTravelsData } from "@/features/travels/hooks/useMyTravelsData";
import type { Nav } from "@/features/travels/lib/myTravelsTypes";

type MyTravelsActionsInput = Pick<
  MyTravelsData,
  | "flights"
  | "sendParcels"
  | "receiveParcels"
  | "partners"
  | "requests"
  | "sentRequests"
  | "connections"
  | "myProfile"
> & { navigation: Nav };

/**
 * What My Travels can do to its lists - edit, delete, rate, accept / reject /
 * cancel buddy requests, open chats - with the pending and error state each
 * action reports through. Moved verbatim out of MyTravelsScreen.tsx.
 */
export function useMyTravelsActions({
  navigation,
  flights,
  sendParcels,
  receiveParcels,
  partners,
  requests,
  sentRequests,
  connections,
  myProfile,
}: MyTravelsActionsInput) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [actioningId, setActioningId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [editPending, setEditPending] = useState(false);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [editParcelPending, setEditParcelPending] = useState(false);
  // The server's refusal of an edit, shown inside the modal (27 Oct 2026).
  const [editParcelError, setEditParcelError] = useState<string | null>(null);
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
    setEditParcelError(null);
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

      // Online order / return block: only what changed (27 Oct 2026).
      Object.assign(data, returnFormChanges(values.returnForm, editingParcel));

      if (Object.keys(data).length === 0) {
        setEditingParcel(null);
        return;
      }

      setEditParcelPending(true);
      setEditParcelError(null);
      try {
        await parcelsApi.update(editingParcel.id, data);
        // The parcel lives in either Send or Receive — refresh both.
        await Promise.all([sendParcels.refetch(), receiveParcels.refetch()]);
        setEditingParcel(null);
      } catch (err) {
        setEditParcelError(getErrorMessage(err));
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
      // Sent only when changed (27 Oct 2026): off retires the buddy listing, on creates one.
      if (values.open_to_buddy !== !!editingTrip.open_to_buddy) {
        data.open_to_buddy = values.open_to_buddy;
      }

      if (Object.keys(data).length === 0) {
        setEditingTrip(null);
        return;
      }

      setEditPending(true);
      try {
        const res = await tripsApi.update(editingTrip.id, data);
        const buddyMsg = editTripBuddyMessage(data.open_to_buddy, res?.data?.buddy_listing);
        // A buddy listing was added or removed: Travel Partners must show it.
        await Promise.all([flights.refetch(), ...(buddyMsg ? [partners.refetch()] : [])]);
        setEditingTrip(null);
        if (buddyMsg) showToast({ title: buddyMsg.text, variant: buddyMsg.variant });
      } catch (err) {
        setFormError(`Couldn't update trip. ${getErrorMessage(err)}`);
      } finally {
        setEditPending(false);
      }
    },
    [editingTrip, flights, partners],
  );

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
        // 27 Oct 2026: same words as web.
        showToast({ title: "Buddy request declined", variant: "success" });
        await requests.refetch();
      } catch (err) {
        setFormError(`Couldn't decline request. ${getErrorMessage(err)}`);
      } finally {
        setActioningId(null);
      }
    },
    [requests],
  );

  const handleCancelSentRequest = useCallback(
    (request: BuddyRequest, recipientName: string) => {
      showAppAlert({
        title: `Cancel your request to ${recipientName}?`,
        message: "It will be removed from their requests. You can send a new one later.",
        actions: [
          { text: "Keep request", style: "cancel" },
          {
            text: "Cancel request",
            style: "destructive",
            onPress: () => {
              void (async () => {
                setActioningId(request.id);
                setFormError(null);
                try {
                  await buddiesApi.cancelRequest(request.id);
                  await sentRequests.refetch();
                } catch (err) {
                  // 409 = they answered first (or it was already cancelled);
                  // refresh so the stale row drops out either way.
                  setFormError(`Couldn't cancel request. ${getErrorMessage(err)}`);
                  void sentRequests.refetch();
                } finally {
                  setActioningId(null);
                }
              })();
            },
          },
        ],
      });
    },
    [sentRequests],
  );

  const handleCompleteConnection = useCallback(
    async (id: string) => {
      setActioningId(id);
      setFormError(null);
      try {
        const res = await buddiesApi.completeConnection(id);
        // 27 Oct 2026: tell the user where the journey stands (web parity).
        showToast({
          title:
            res.data?.status === "completed"
              ? "Journey confirmed — you can now leave a review"
              : "Marked complete — waiting for your buddy to confirm",
          variant: "success",
        });
        await connections.refetch();
      } catch (err) {
        setFormError(`Couldn't confirm the journey. ${getErrorMessage(err)}`);
      } finally {
        setActioningId(null);
      }
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
        name: conn.buddy?.name ?? "Traveler",
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

  return {
    deletingId,
    actioningId,
    formError,
    setFormError,
    editingTrip,
    editPending,
    editingParcel,
    editParcelPending,
    editParcelError,
    editingBuddy,
    editBuddyPending,
    ratingConn,
    ratePending,
    matchSource,
    setMatchSource,
    chatPendingId,
    handleViewTripMatches,
    handleViewParcelMatches,
    handleDeleteTrip,
    handleDeleteSendParcel,
    handleDeleteReceiveParcel,
    handleDeleteBuddy,
    handleOpenTrip,
    handleOpenParcel,
    handleEditBuddy,
    handleEditBuddyCancel,
    handleOpenBuddy,
    handleEditBuddySubmit,
    handleEditParcel,
    handleEditParcelCancel,
    handleEditParcelSubmit,
    handleEditTrip,
    handleEditTripCancel,
    handleEditTripSubmit,
    handleRateDelivery,
    handleOpenDelivery,
    handleAcceptRequest,
    handleRejectRequest,
    handleCancelSentRequest,
    handleCompleteConnection,
    handleChatCounterpart,
    handleChatConnection,
    handleOpenRate,
    handleRateCancel,
    handleRateSubmit,
  };
}

export type MyTravelsActions = ReturnType<typeof useMyTravelsActions>;
