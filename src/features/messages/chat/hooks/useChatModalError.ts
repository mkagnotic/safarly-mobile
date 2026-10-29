import { useEffect, useState } from "react";

import { type ChatModal, type ChatModalError, type SetChatModalError } from "../chatTypes";

/**
 * A request that fails while one of the chat's Modals is open is reported
 * INSIDE that Modal: `showToast` renders in the root view, under any open
 * Modal, so the failure used to look like nothing happened. Tagged with the
 * Modal it belongs to; cleared on retry and when that Modal closes (see
 * `useClearModalErrorOnClose`).
 */
export function useChatModalError() {
  const [modalError, setModalError] = useState<ChatModalError>(null);
  const errorFor = (modal: ChatModal) => (modalError?.modal === modal ? modalError.message : null);
  return { modalError, setModalError, errorFor };
}

/** Drop a Modal's error once that Modal closes, so it never reopens stale. */
export function useClearModalErrorOnClose(
  setModalError: SetChatModalError,
  {
    matchModalOpen,
    matchCandidates,
    declineOpen,
    confirmAction,
    reportTarget,
    reportUserOpen,
    travelDocOpen,
    parcelReviewOpen,
  }: {
    matchModalOpen: boolean;
    matchCandidates: unknown[] | null;
    declineOpen: boolean;
    confirmAction: "block" | "unblock" | "unmatch" | null;
    reportTarget: unknown;
    reportUserOpen: boolean;
    travelDocOpen: boolean;
    parcelReviewOpen: boolean;
  },
) {
  // `setModalError` is a state setter, so listing it changes nothing: the effect
  // still runs only when one of the open flags changes.
  useEffect(() => {
    const open: Record<ChatModal, boolean> = {
      match: matchModalOpen,
      dealPicker: !!matchCandidates,
      decline: declineOpen,
      confirm: !!confirmAction,
      reportMessage: !!reportTarget,
      reportUser: reportUserOpen,
      travelDoc: travelDocOpen,
      parcelReview: parcelReviewOpen,
    };
    setModalError((current) => (current && !open[current.modal] ? null : current));
  }, [matchModalOpen, matchCandidates, declineOpen, confirmAction, reportTarget, reportUserOpen,
      travelDocOpen, parcelReviewOpen, setModalError]);
}
