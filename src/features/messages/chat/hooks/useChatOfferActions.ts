import { useCallback, useEffect, useRef, useState } from "react";

import { type OfferComposerSubmit } from "@/components/chat/OfferComposerModal";
import { type ResolvedOffers } from "@/features/messages/offerResolution";
import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";
import { type UseOffersResult } from "@/hooks/api/useOffers";
import { ApiClientError, getErrorMessage, newIdempotencyKey } from "@/services/api";

import { type ChatNav, type ChatUser } from "../chatTypes";

interface UseChatOfferActionsInput {
  liveOffer: ResolvedOffers["live"];
  activeDeal: UseActiveDealResult["activeDeal"];
  user: ChatUser;
  navigation: ChatNav;
  participantName: string;
  seedOffer: UseOffersResult["seedOffer"];
  postOffer: UseOffersResult["postOffer"];
  acceptOffer: UseOffersResult["acceptOffer"];
  rejectOffer: UseOffersResult["rejectOffer"];
  markOfferSettled: (offerId: string) => void;
  setActionMenuOpen: (open: boolean) => void;
}

/**
 * In-chat price offers: the composer (seed / counter), accept and decline, and
 * the feedback banner that reports how each went.
 */
export function useChatOfferActions({
  liveOffer,
  activeDeal,
  user,
  navigation,
  participantName,
  seedOffer,
  postOffer,
  acceptOffer,
  rejectOffer,
  markOfferSettled,
  setActionMenuOpen,
}: UseChatOfferActionsInput) {
  const [offerComposer, setOfferComposer] = useState<{ mode: "seed" | "counter" } | null>(null);
  const [offerBanner, setOfferBanner] = useState<{
    variant: "success" | "error" | "info" | "warning";
    title: string;
    message?: string;
  } | null>(null);

  // Auto-dismiss the offer feedback banner like a standard toast — success/info
  // clear quickly, errors linger a little longer so they stay readable. The
  // manual × still works: dismissing sets it to null, which runs this cleanup.
  useEffect(() => {
    if (!offerBanner) return;
    const ms = offerBanner.variant === "error" ? 5000 : 2800;
    const timer = setTimeout(() => setOfferBanner(null), ms);
    return () => clearTimeout(timer);
  }, [offerBanner]);
  /** Shown when the carrier tries to accept but hasn't finished payout setup. */
  const [payoutRequiredOpen, setPayoutRequiredOpen] = useState(false);

  // ───────── Offer handlers ─────────

  const handleOpenOfferComposer = useCallback(() => {
    setActionMenuOpen(false);
    setOfferBanner(null);
    // Counter the live offer when one exists (reuses its carrier_request);
    // otherwise seed a brand-new offer.
    setOfferComposer({ mode: liveOffer?.carrierRequestId ? "counter" : "seed" });
  }, [liveOffer, setActionMenuOpen]);

  // One key per attempt at an offer: a double tap, or a retry after a dropped
  // response, is answered by the server with the offer it already made instead of
  // creating a second one. The ref also stops a second tap that lands before
  // `pending` has re-rendered the composer's button as disabled.
  const offerAttemptKeyRef = useRef<string | null>(null);
  const offerSubmittingRef = useRef(false);

  const handleSubmitOffer = useCallback(
    async ({ amount, note }: OfferComposerSubmit) => {
      if (!offerComposer || offerSubmittingRef.current) return;
      offerSubmittingRef.current = true;
      if (!offerAttemptKeyRef.current) offerAttemptKeyRef.current = newIdempotencyKey();
      const attemptKey = offerAttemptKeyRef.current;
      // Post into the EXISTING deal whenever one exists. Web always sends the
      // offer with `activeDeal.carrier_request_id` (`ChatOfferPrompt`), even for
      // the very first fee offer. `seed-offer` instead auto-detects a brand-new
      // trip+parcel pair and 404s once the listings are locked into a deal — so
      // it's only for starting a deal from scratch (no carrier_request yet).
      const carrierRequestId =
        liveOffer?.carrierRequestId ?? activeDeal?.carrier_request_id ?? null;
      try {
        if (carrierRequestId) {
          await postOffer({ carrier_request_id: carrierRequestId, amount, note }, attemptKey);
        } else {
          await seedOffer({ amount, note });
        }
        setOfferComposer(null);
        setOfferBanner({
          variant: "success",
          title: liveOffer ? "Counter sent" : "Offer sent",
        });
      } catch (err) {
        setOfferComposer(null);
        setOfferBanner({
          variant: "error",
          title: "Couldn't send offer",
          message: getErrorMessage(err),
        });
      } finally {
        // The attempt is over either way (the composer closes on both paths), so the
        // next offer gets its own key and the guard is released.
        offerSubmittingRef.current = false;
        offerAttemptKeyRef.current = null;
      }
    },
    [offerComposer, liveOffer, activeDeal?.carrier_request_id, postOffer, seedOffer],
  );

  const handleAcceptOffer = useCallback(
    async (offerId: string) => {
      setOfferBanner(null);
      try {
        const result = await acceptOffer(offerId);
        markOfferSettled(offerId);
        setOfferBanner({ variant: "success", title: "Offer accepted — match confirmed!" });
        // Only the parcel sender is routed onward to pay (Part 3); the carrier stays here.
        const booking = result.booking;
        if (booking?.id && booking.sender_id === user?.id) {
          navigation.navigate("PayBookingTab", { bookingId: booking.id });
        }
      } catch (err) {
        // Carrier payout not set up: turn the backend dead-end into an action.
        // If the viewer IS the carrier, show the actionable dialog; if they're
        // the sender there's nothing they can fix — the backend already nudged
        // the carrier, so just inform them. Web parity: ChatOfferPrompt.
        if (err instanceof ApiClientError && err.code === "CARRIER_PAYOUT_NOT_READY") {
          if (activeDeal?.viewer_role === "carrier") {
            setPayoutRequiredOpen(true);
          } else {
            setOfferBanner({
              variant: "info",
              title: "Payout setup needed",
              message: `${participantName} hasn't set up how they get paid yet. We've let them know — you'll be able to accept once they finish payout setup.`,
            });
          }
          return;
        }
        setOfferBanner({
          variant: "error",
          title: "Couldn't accept offer",
          message: getErrorMessage(err),
        });
      }
    },
    [acceptOffer, navigation, user?.id, activeDeal?.viewer_role, participantName, markOfferSettled],
  );

  const handleDeclineOffer = useCallback(
    async (offerId: string) => {
      setOfferBanner(null);
      try {
        await rejectOffer(offerId);
        markOfferSettled(offerId);
        setOfferBanner({ variant: "info", title: "Offer declined" });
      } catch (err) {
        setOfferBanner({
          variant: "error",
          title: "Couldn't decline offer",
          message: getErrorMessage(err),
        });
      }
    },
    [rejectOffer, markOfferSettled],
  );

  return {
    offerComposer,
    setOfferComposer,
    offerBanner,
    setOfferBanner,
    payoutRequiredOpen,
    setPayoutRequiredOpen,
    handleOpenOfferComposer,
    handleSubmitOffer,
    handleAcceptOffer,
    handleDeclineOffer,
  };
}
