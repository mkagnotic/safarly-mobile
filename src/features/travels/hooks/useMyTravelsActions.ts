import { useCallback, useState } from "react";

import { showAppAlert, showToast } from "@/feedback/appFeedback";
import { buddyEditPayload } from "@/features/buddies/editBuddyPayload";
import type { EditBuddyListingFormValues } from "@/features/buddies/EditBuddyListingModal";
import type { RateBuddyValues } from "@/features/buddies/RateBuddyModal";
import type { EditParcelFormValues, EditParcelSubmitOptions } from "@/features/parcels/EditParcelModal";
import { parcelEditPayload } from "@/features/parcels/model/editParcelPayload";
import { returnFormChanges } from "@/utils/addressOptions";
import type { MatchesSource } from "@/features/travels/MatchesModal";
import type { EditTripFormValues } from "@/features/trips/EditTripModal";
import { tripEditPayload } from "@/features/trips/model/editTripPayload";
import { editTripBuddyMessage } from "@/features/trips/model/openBuddy";
import { useParcelDetail } from "@/hooks/api/useParcelDetail";
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

/** The server's reason as a sentence, so "Try again." reads after it. */
function asSentence(text: string): string {
  const t = text.trim();
  return !t || /[.!?]$/.test(t) ? t : `${t}.`;
}

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
  // Edit refusals show inside the open modal, not behind it (28 Oct 2026).
  const [editTripError, setEditTripError] = useState<string | null>(null);
  const [editingParcel, setEditingParcel] = useState<Parcel | null>(null);
  const [editParcelPending, setEditParcelPending] = useState(false);
  // The server's refusal of an edit, shown inside the modal (27 Oct 2026).
  const [editParcelError, setEditParcelError] = useState<string | null>(null);
  const [editingBuddy, setEditingBuddy] = useState<BuddyListing | null>(null);
  const [editBuddyPending, setEditBuddyPending] = useState(false);
  const [editBuddyError, setEditBuddyError] = useState<string | null>(null);
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

  // 28 Oct 2026: a success toast and an error that names the thing (web words).
  const withDeleteFlow = useCallback(
    async (
      id: string,
      mutate: (id: string) => Promise<unknown>,
      after: () => void,
      words: { done: string; failed: string },
    ) => {
      setDeletingId(id);
      setFormError(null);
      try {
        await mutate(id);
        showToast({ title: words.done, variant: "success" });
        after();
      } catch (err) {
        setFormError([words.failed, asSentence(getErrorMessage(err)), "Try again."].filter(Boolean).join(" "));
      } finally {
        setDeletingId(null);
      }
    },
    [],
  );

  const handleDeleteTrip = useCallback(
    (trip: Trip) =>
      withDeleteFlow(trip.id, (id) => tripsApi.delete(id), flights.refetch, {
        done: "Trip cancelled",
        failed: "Couldn't cancel this trip.",
      }),
    [withDeleteFlow, flights.refetch],
  );

  const handleDeleteReceiveParcel = useCallback(
    (parcel: Parcel) =>
      withDeleteFlow(
        parcel.id,
        (id) => parcelsApi.delete(id),
        receiveParcels.refetch,
        { done: "Parcel cancelled", failed: "Couldn't cancel this parcel." },
      ),
    [withDeleteFlow, receiveParcels.refetch],
  );

  const handleDeleteBuddy = useCallback(
    (id: string) =>
      withDeleteFlow(id, (lid) => buddiesApi.deleteListing(lid), partners.refetch, {
        done: "Buddy listing removed",
        failed: "Couldn't remove this buddy listing.",
      }),
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
    setEditBuddyError(null);
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

      // Full upsert body, countries included (editBuddyPayload.ts).
      const payload = buddyEditPayload(values);

      setEditBuddyPending(true);
      setEditBuddyError(null);
      try {
        await buddiesApi.update(editingBuddy.id, payload);
        await partners.refetch();
        setEditingBuddy(null);
        showToast({ title: "Buddy listing updated", variant: "success" });
      } catch (err) {
        setEditBuddyError(getErrorMessage(err));
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

  // List rows carry neither currency_locked nor the private return address
  // (street, postal code, order number): both come only on the owner's detail
  // read, so Edit loads it, as web's EditParcelDialog does (28 Oct 2026).
  const parcelDetail = useParcelDetail(editingParcel?.id);
  const editParcelDetail =
    editingParcel && parcelDetail.parcel?.id === editingParcel.id ? parcelDetail.parcel : null;

  const handleEditParcelSubmit = useCallback(
    async (values: EditParcelFormValues, options: EditParcelSubmitOptions) => {
      if (!editingParcel) return;
      const stored = editParcelDetail ?? editingParcel;
      const data = parcelEditPayload(
        values,
        stored,
        options.includeReturn ? returnFormChanges(values.returnForm, stored) : {},
      );

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
        showToast({ title: "Parcel updated", variant: "success" });
      } catch (err) {
        setEditParcelError(getErrorMessage(err));
      } finally {
        setEditParcelPending(false);
      }
    },
    [editingParcel, editParcelDetail, sendParcels, receiveParcels],
  );

  const handleEditTrip = useCallback((trip: Trip) => {
    setFormError(null);
    setEditTripError(null);
    setEditingTrip(trip);
  }, []);

  const handleEditTripCancel = useCallback(() => {
    if (!editPending) setEditingTrip(null);
  }, [editPending]);

  const handleEditTripSubmit = useCallback(
    async (values: EditTripFormValues) => {
      if (!editingTrip) return;
      // Only what changed; the modal has validated (editTripPayload.ts).
      const data = tripEditPayload(values, editingTrip);

      if (Object.keys(data).length === 0) {
        setEditingTrip(null);
        return;
      }

      setEditPending(true);
      setEditTripError(null);
      try {
        const res = await tripsApi.update(editingTrip.id, data);
        const buddyMsg = editTripBuddyMessage(data.open_to_buddy, res?.data?.buddy_listing);
        // A buddy listing was added or removed: Travel Partners must show it.
        await Promise.all([flights.refetch(), ...(buddyMsg ? [partners.refetch()] : [])]);
        setEditingTrip(null);
        // The buddy note, when there is one, already says the trip saved.
        showToast(buddyMsg ? { title: buddyMsg.text, variant: buddyMsg.variant } : { title: "Trip updated", variant: "success" });
      } catch (err) {
        setEditTripError(getErrorMessage(err));
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
        showToast({ title: "Buddy request accepted", variant: "success" });
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
                  showToast({ title: "Buddy request cancelled", variant: "success" });
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
    editTripError,
    editingParcel,
    editParcelPending,
    editParcelError,
    editParcelDetail,
    editingBuddy,
    editBuddyPending,
    editBuddyError,
    ratingConn,
    ratePending,
    matchSource,
    setMatchSource,
    chatPendingId,
    handleViewTripMatches,
    handleViewParcelMatches,
    handleDeleteTrip,
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
