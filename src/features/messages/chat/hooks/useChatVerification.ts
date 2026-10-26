import { useCallback, useState } from "react";

import { showToast } from "@/feedback/appFeedback";
import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";
import { type UseMyConversationsResult } from "@/hooks/api/useMyConversations";
import { useParcelReview } from "@/hooks/api/useParcelReview";
import { useTravelDoc } from "@/hooks/api/useTravelDoc";
import { getErrorMessage, type ParcelReviewReason, type RNUploadFile } from "@/services/api";

import { type SetChatModalError } from "../chatTypes";

interface UseChatVerificationInput {
  activeDeal: UseActiveDealResult["activeDeal"];
  workflow: UseActiveDealResult["workflow"];
  refetchActiveDeal: UseActiveDealResult["refetch"];
  refetchConversations: UseMyConversationsResult["refetch"];
  setModalError: SetChatModalError;
}

/** The two verification stages the pin opens: the travel document and the parcel photos. */
export function useChatVerification({
  activeDeal,
  workflow,
  refetchActiveDeal,
  refetchConversations,
  setModalError,
}: UseChatVerificationInput) {
  const [travelDocOpen, setTravelDocOpen] = useState(false);
  const [parcelReviewOpen, setParcelReviewOpen] = useState(false);

  // ───────── Travel-document verification ─────────
  // Only fetch the doc while the deal is actually in a verification stage (or the
  // modal is open), so we don't hit the endpoint for every conversation. The pin
  // CTA itself comes from the server FSM regardless; this just backs the modal.
  const travelDocRequestId =
    workflow?.state === "TRAVEL_VERIFICATION" ||
    workflow?.state === "ADMIN_REVIEW" ||
    travelDocOpen
      ? activeDeal?.carrier_request_id ?? null
      : null;
  const travelDoc = useTravelDoc(travelDocRequestId);

  // ───────── Parcel-photo review ─────────
  const parcelReviewRequestId =
    workflow?.state === "PARCEL_REVIEW" || parcelReviewOpen
      ? activeDeal?.carrier_request_id ?? null
      : null;
  const parcelReview = useParcelReview(parcelReviewRequestId);

  // ───────── Travel-doc action handlers ─────────
  // Each forwards to the hook (which refetches the doc), toasts, and — for the
  // actions that advance the FSM (approve/withdraw) — nudges the workflow pin so
  // it moves on without waiting for the realtime round-trip.
  const handleDocUpload = useCallback(
    async (files: RNUploadFile[]) => {
      setModalError(null);
      try {
        await travelDoc.upload(files);
        // Done with the sheet once the step is submitted - the pin shows what is
        // next. Client, 22 Oct 2026: it stayed open until the user found the X.
        setTravelDocOpen(false);
        showToast({ title: "Document uploaded", variant: "success", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        setModalError({ modal: "travelDoc", message: `Upload failed. ${getErrorMessage(err)}` });
      }
    },
    [travelDoc, refetchActiveDeal, setModalError],
  );

  const handleDocApprove = useCallback(async () => {
    setModalError(null);
    try {
      await travelDoc.approve();
      setTravelDocOpen(false);
      showToast({ title: "Document approved", variant: "success", duration: 1800 });
      void refetchActiveDeal();
    } catch (err) {
      setModalError({ modal: "travelDoc", message: `Couldn't approve. ${getErrorMessage(err)}` });
    }
  }, [travelDoc, refetchActiveDeal, setModalError]);

  const handleDocReject = useCallback(
    async (reason: string) => {
      setModalError(null);
      try {
        await travelDoc.reject(reason);
        setTravelDocOpen(false);
        showToast({ title: "Re-upload requested", variant: "info", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        setModalError({ modal: "travelDoc", message: `Couldn't request re-upload. ${getErrorMessage(err)}` });
      }
    },
    [travelDoc, refetchActiveDeal, setModalError],
  );

  const handleDocAdminReview = useCallback(async () => {
    setModalError(null);
    try {
      await travelDoc.requestAdminReview();
      setTravelDocOpen(false);
      showToast({ title: "Admin review requested", variant: "info", duration: 1800 });
    } catch (err) {
      setModalError({ modal: "travelDoc", message: `Couldn't escalate. ${getErrorMessage(err)}` });
    }
  }, [travelDoc, setModalError]);

  const handleDocCancelMatch = useCallback(async () => {
    setModalError(null);
    try {
      await travelDoc.withdraw();
      setTravelDocOpen(false);
      showToast({ title: "Match cancelled", variant: "info", duration: 1800 });
      void refetchActiveDeal();
      void refetchConversations();
    } catch (err) {
      setModalError({ modal: "travelDoc", message: `Couldn't cancel. ${getErrorMessage(err)}` });
    }
  }, [travelDoc, refetchActiveDeal, refetchConversations, setModalError]);

  // ───────── Parcel-review action handlers ─────────
  const handleParcelUpload = useCallback(
    async (files: RNUploadFile[]) => {
      setModalError(null);
      try {
        await parcelReview.upload(files);
        // Same as the travel document: submitted means done with the sheet.
        setParcelReviewOpen(false);
        showToast({ title: "Photos submitted", variant: "success", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        setModalError({ modal: "parcelReview", message: `Upload failed. ${getErrorMessage(err)}` });
      }
    },
    [parcelReview, refetchActiveDeal, setModalError],
  );

  const handleParcelApprove = useCallback(async () => {
    setModalError(null);
    try {
      await parcelReview.approve();
      setParcelReviewOpen(false);
      showToast({ title: "Parcel approved", variant: "success", duration: 1800 });
      void refetchActiveDeal();
    } catch (err) {
      setModalError({ modal: "parcelReview", message: `Couldn't approve. ${getErrorMessage(err)}` });
    }
  }, [parcelReview, refetchActiveDeal, setModalError]);

  const handleParcelReject = useCallback(
    async (reason: ParcelReviewReason, note?: string) => {
      setModalError(null);
      try {
        await parcelReview.reject(reason, note);
        setParcelReviewOpen(false);
        showToast({ title: "Changes requested", variant: "info", duration: 1800 });
        void refetchActiveDeal();
      } catch (err) {
        setModalError({ modal: "parcelReview", message: `Couldn't request changes. ${getErrorMessage(err)}` });
      }
    },
    [parcelReview, refetchActiveDeal, setModalError],
  );

  const handleParcelCancel = useCallback(async () => {
    setModalError(null);
    try {
      await parcelReview.cancel();
      setParcelReviewOpen(false);
      showToast({ title: "Request cancelled", variant: "info", duration: 1800 });
      void refetchActiveDeal();
      void refetchConversations();
    } catch (err) {
      setModalError({ modal: "parcelReview", message: `Couldn't cancel. ${getErrorMessage(err)}` });
    }
  }, [parcelReview, refetchActiveDeal, refetchConversations, setModalError]);

  return {
    travelDocOpen,
    setTravelDocOpen,
    parcelReviewOpen,
    setParcelReviewOpen,
    travelDoc,
    parcelReview,
    handleDocUpload,
    handleDocApprove,
    handleDocReject,
    handleDocAdminReview,
    handleDocCancelMatch,
    handleParcelUpload,
    handleParcelApprove,
    handleParcelReject,
    handleParcelCancel,
  };
}
