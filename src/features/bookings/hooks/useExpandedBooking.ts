import { useCallback, useEffect, useRef, useState } from "react";

import { useBookingDetail } from "@/hooks/api/useBookingDetail";
import { ApiClientError, getErrorMessage } from "@/services/api";

/**
 * Everything one expanded booking card holds: its detail fetch, the action in
 * flight, which modal is open, the one-time delivery code and the inline
 * action banner. Moved verbatim out of `ExpandedBody` in BookingsScreen.tsx.
 */
const ACTION_FAILED_TITLE: Record<string, string> = {
  "accept-handoff": "Couldn't accept the parcel",
  "reject-handoff": "Couldn't decline the parcel",
  "set-handoff-plan": "Couldn't save the handover plan",
  "mark-handoff-sent": "Couldn't mark the parcel as sent",
  "set-return-resolution": "Couldn't save the return plan",
  "complete-return": "Couldn't complete the return",
  "confirm-return-received": "Couldn't confirm the return",
  cancel: "Couldn't cancel the booking",
  "cancel-post-possession": "Couldn't cancel the delivery",
  "generate-otp": "Couldn't create a delivery code",
  "confirm-otp": "Couldn't confirm the delivery",
  "confirm-ready": "Couldn't confirm you're ready",
  "start-journey": "Couldn't start the journey",
  "mark-landed": "Couldn't mark that you've landed",
  "report-delay": "Couldn't report the delay",
};

export function useExpandedBooking(bookingId: string) {
  // Detail fetch only fires when this row is expanded — so the list remains
  // light. Mirrors web's TanStack `useBookingDetail` enabled-on-mount of the
  // expanded card.
  const { booking, timeline, error, refetch } = useBookingDetail(bookingId);

  const [actionPending, setActionPending] = useState<
    | null
    | "accept-handoff"
    | "reject-handoff"
    | "set-handoff-plan"
    | "mark-handoff-sent"
    | "set-return-resolution"
    | "complete-return"
    | "confirm-return-received"
    | "cancel"
    | "cancel-post-possession"
    | "generate-otp"
    | "confirm-otp"
    | "confirm-ready"
    | "start-journey"
    | "mark-landed"
    | "report-delay"
  >(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [acceptHandoffOpen, setAcceptHandoffOpen] = useState(false);
  const [rejectHandoffOpen, setRejectHandoffOpen] = useState(false);
  const [cancelPostPossessionOpen, setCancelPostPossessionOpen] = useState(false);
  // Failure of the action an open modal runs — shown inside that modal, since
  // the card banner is drawn underneath it. Cleared on close and on retry.
  const [modalError, setModalError] = useState<string | null>(null);
  const [otpCode, setOtpCode] = useState("");
  // The server returns the plaintext OTP exactly once on generate-otp; if we
  // drop it here the sender can never see it again. Keep it in screen state.
  const [generatedOtp, setGeneratedOtp] = useState<string | null>(null);
  // The plaintext code is returned ONCE, so the sender needs to know a durable
  // copy went to their inbox rather than assuming the screen is the only copy.
  const [otpEmailed, setOtpEmailed] = useState(false);

  // Inline action feedback — matches the rest of the app (see SendParcelScreen)
  // by rendering `FormBanner` at the top of the affected card instead of toasts.
  type BannerVariant = "success" | "error" | "info" | "warning";
  const [actionBanner, setActionBanner] = useState<
    { variant: BannerVariant; title?: string; message?: string } | null
  >(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismissBanner = useCallback(() => {
    if (bannerTimerRef.current) {
      clearTimeout(bannerTimerRef.current);
      bannerTimerRef.current = null;
    }
    setActionBanner(null);
  }, []);

  const showBanner = useCallback(
    (next: { variant: BannerVariant; title?: string; message?: string }, autoDismissMs = 4000) => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
      setActionBanner(next);
      if (autoDismissMs > 0) {
        bannerTimerRef.current = setTimeout(() => {
          setActionBanner(null);
          bannerTimerRef.current = null;
        }, autoDismissMs);
      }
    },
    [],
  );

  useEffect(
    () => () => {
      if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
    },
    [],
  );

  const runAction = useCallback(
    async <T,>(
      key:
        | "accept-handoff"
        | "reject-handoff"
        | "set-handoff-plan"
        | "mark-handoff-sent"
        | "set-return-resolution"
        | "complete-return"
        | "confirm-return-received"
    | "confirm-return-received"
        | "cancel"
        | "cancel-post-possession"
        | "generate-otp"
        | "confirm-otp"
        | "confirm-ready"
        | "start-journey"
        | "mark-landed"
        | "report-delay",
      task: () => Promise<T>,
      /** A function when the words depend on the server's answer. */
      successMessage: string | ((result: T) => string),
      /** Optional per-action mapper for friendlier copy on specific error codes. */
      formatError?: (code: string, message: string) => string,
      /**
       * Where a failure goes when the action runs from an open Modal. The card
       * banner renders in the screen, UNDER the Modal, so a failure there was
       * invisible; the modal shows it inline instead and stays open to retry.
       */
      onError?: (message: string) => void,
    ): Promise<T | null> => {
      setActionPending(key);
      try {
        const result = await task();
        await refetch();
        showBanner({ variant: "success", title: typeof successMessage === "function" ? successMessage(result) : successMessage });
        return result;
      } catch (err) {
        const code = err instanceof ApiClientError ? err.code : "";
        const base =
          err instanceof ApiClientError ? err.message : getErrorMessage(err as Error);
        const message = formatError ? formatError(code, base) : base;
        if (onError) onError(message);
        // Says WHAT failed; every carrier action used to read "Action failed" (27 Oct 2026).
        else showBanner({ variant: "error", title: ACTION_FAILED_TITLE[key] ?? "Something went wrong", message }, 6000);
        // The guard may have rejected because the state moved — re-derive actions.
        void refetch();
        return null;
      } finally {
        setActionPending(null);
      }
    },
    [refetch, showBanner],
  );

  return {
    booking,
    timeline,
    error,
    refetch,
    actionPending,
    cancelOpen,
    setCancelOpen,
    acceptHandoffOpen,
    setAcceptHandoffOpen,
    rejectHandoffOpen,
    setRejectHandoffOpen,
    cancelPostPossessionOpen,
    setCancelPostPossessionOpen,
    modalError,
    setModalError,
    otpCode,
    setOtpCode,
    generatedOtp,
    setGeneratedOtp,
    otpEmailed,
    setOtpEmailed,
    actionBanner,
    dismissBanner,
    showBanner,
    runAction,
  };
}

export type ExpandedBookingState = ReturnType<typeof useExpandedBooking>;
