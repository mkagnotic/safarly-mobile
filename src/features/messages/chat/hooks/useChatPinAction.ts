import { useCallback } from "react";

import { showAppAlert } from "@/feedback/appFeedback";
import { type ResolvedOffers } from "@/features/messages/offerResolution";
import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";

import { formatMoney } from "../chatHelpers";
import { type ChatNav, type ChatUser } from "../chatTypes";

interface UseChatPinActionInput {
  activeDeal: UseActiveDealResult["activeDeal"];
  liveOffer: ResolvedOffers["live"];
  user: ChatUser;
  participantName: string;
  navigation: ChatNav;
  handleAccept: () => Promise<void>;
  handleAcceptOffer: (offerId: string) => Promise<void>;
  handleOpenOfferComposer: () => void;
  setMatchModalOpen: (open: boolean) => void;
  setTravelDocOpen: (open: boolean) => void;
  setParcelReviewOpen: (open: boolean) => void;
}

/**
 * Runs a workflow-pin CTA. The pin is a projection of the server FSM; this
 * maps each `cta.code` to the mobile capability that satisfies it. Codes for
 * stages that already have bespoke UI (match handshake, live offer) route to
 * those same handlers, so behaviour stays consistent if the pin ever shows
 * them. Travel-doc and parcel-review are not yet built on mobile (their own
 * phases) — those codes explain that rather than dead-ending.
 */
export function useChatPinAction({
  activeDeal,
  liveOffer,
  user,
  participantName,
  navigation,
  handleAccept,
  handleAcceptOffer,
  handleOpenOfferComposer,
  setMatchModalOpen,
  setTravelDocOpen,
  setParcelReviewOpen,
}: UseChatPinActionInput) {
  const handlePinAction = useCallback(
    (code: string) => {
      const bookingId = activeDeal?.booking_id ?? null;
      switch (code) {
        case "request_match":
        case "request_match_again":
          setMatchModalOpen(true);
          return;
        case "accept_match":
          void handleAccept();
          return;
        case "make_offer":
          handleOpenOfferComposer();
          return;
        case "accept_offer": {
          // "Review" the offer waiting on me — the same accept the offer bar's
          // Accept button runs, behind a look at the amount. This used to open
          // the counter composer, so the pin could never actually accept. The
          // pin only shows when the offer bar is hidden (offer not in the loaded
          // page), so fall back to the deal's own open offer.
          const fromDeal = activeDeal?.offer;
          const open =
            liveOffer && !liveOffer.mine
              ? { id: liveOffer.offerId, amount: liveOffer.amount, currency: liveOffer.currency }
              : fromDeal && fromDeal.status === "open" && fromDeal.proposed_by !== user?.id
                ? { id: fromDeal.offer_id, amount: fromDeal.amount, currency: fromDeal.currency }
                : null;
          if (!open) {
            handleOpenOfferComposer();
            return;
          }
          showAppAlert({
            title: `Accept ${formatMoney(open.amount, open.currency)}?`,
            message: `${participantName} offered this as the delivery price. Accepting confirms the deal at this amount.`,
            actions: [
              { text: "Not now", style: "cancel" },
              { text: "Counter", onPress: handleOpenOfferComposer },
              { text: "Accept", onPress: () => void handleAcceptOffer(open.id) },
            ],
          });
          return;
        }
        case "pay":
        case "pay_grace":
          if (bookingId) navigation.navigate("PayBookingTab", { bookingId });
          return;
        // Every post-payment step lives on the booking card (web parity): the
        // pickup confirmation, the sender's delivery code and the carrier's
        // code entry are all there, each labelled with its step. `verify_otp`
        // used to open a standalone mock OTP screen backed by the local store,
        // which never called the API — it could not confirm a delivery.
        case "verify_otp":
        case "generate_otp":
        case "share_otp":
        case "accept_handoff":
        case "set_handoff_plan":
        case "mark_handoff_sent":
        case "set_return_resolution":
        case "confirm_return_sent":
        case "confirm_return_received":
        // The carrier's journey milestones (stages 8/9/10) are buttons on the
        // same booking card; these pin codes used to fall through to `default`
        // and the tap did nothing.
        case "confirm_ready_to_travel":
        case "start_journey":
        case "mark_ready_to_deliver":
          if (bookingId) navigation.navigate("BookingsTab", { expandId: bookingId });
          return;
        case "completed":
          if (bookingId) navigation.navigate("DeliveryReviewTab", { bookingId });
          return;
        case "upload_travel_doc":
        case "review_travel_doc":
          setTravelDocOpen(true);
          return;
        case "upload_parcel_photos":
        case "review_parcel_photos":
          setParcelReviewOpen(true);
          return;
        default:
          return;
      }
    },
    [activeDeal?.booking_id, activeDeal?.offer, liveOffer, user?.id, participantName,
      handleAccept, handleAcceptOffer, handleOpenOfferComposer, navigation,
      setMatchModalOpen, setTravelDocOpen, setParcelReviewOpen],
  );

  return handlePinAction;
}
