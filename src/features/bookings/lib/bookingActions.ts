import * as Clipboard from "expo-clipboard";

import {
  bookingsApi,
  type Booking,
  type HandoffPlanInput,
  type HandoffAddress,
  type JourneyDelayReason,
  type ReturnResolution,
  type RNUploadFile,
} from "@/services/api";
import { formatMoney } from "@/utils/money";
import type { ExpandedBookingState } from "@/features/bookings/hooks/useExpandedBooking";

type BookingActionDeps = Pick<
  ExpandedBookingState,
  | "runAction"
  | "showBanner"
  | "otpCode"
  | "generatedOtp"
  | "setOtpCode"
  | "setGeneratedOtp"
  | "setOtpEmailed"
  | "setModalError"
  | "setAcceptHandoffOpen"
  | "setRejectHandoffOpen"
  | "setCancelOpen"
  | "setCancelPostPossessionOpen"
> & { booking: Booking; bookingId: string };

/**
 * The expanded card's action handlers. Plain functions rebuilt on every render,
 * exactly as they were when they lived inline in `ExpandedBody`; called only
 * once the booking has loaded.
 */
export function createBookingActions({
  booking,
  bookingId,
  runAction,
  showBanner,
  otpCode,
  generatedOtp,
  setOtpCode,
  setGeneratedOtp,
  setOtpEmailed,
  setModalError,
  setAcceptHandoffOpen,
  setRejectHandoffOpen,
  setCancelOpen,
  setCancelPostPossessionOpen,
}: BookingActionDeps) {
  // ── Handoff plan (phase 1 sub-steps) ────────────────────────────────────────
  // The carrier says HOW the parcel reaches them; the sender then confirms it is
  // on its way. Advisory: accept/decline stay available throughout, so a carrier
  // already holding the parcel is never blocked by an unfinished sub-step.
  const handleSetHandoffPlan = (plan: HandoffPlanInput) =>
    runAction(
      "set-handoff-plan",
      () => bookingsApi.setHandoffPlan(booking.id, plan),
      plan.mode === "shipped"
        ? "Address shared - your sender can now send the parcel"
        : "Meetup details shared with your sender",
    );

  const handleMarkHandoffSent = (args: { tracking_reference?: string; courier?: string }) =>
    runAction(
      "mark-handoff-sent",
      () => bookingsApi.markHandoffDispatched(booking.id, args),
      "Marked as sent - your carrier will inspect it on arrival",
    );

  // ── Parcel return (after a decline / mid-trip cancel) ───────────────────────
  const handleSetReturnResolution = (args: { resolution: ReturnResolution; note?: string; address?: HandoffAddress }) =>
    runAction(
      "set-return-resolution",
      () => bookingsApi.setReturnResolution(booking.id, args),
      "Saved - your carrier has been told what to do with the parcel",
    );

  const handleCompleteReturn = (args: { tracking_reference?: string }) =>
    runAction(
      "complete-return",
      () => bookingsApi.completeReturn(booking.id, args),
      "Thanks - the sender has been told the parcel is on its way back",
    );

  // ⚠️ What actually CLOSES a hand-back. The carrier's step above only says they
  // posted it; before this the deal ended right there, so a parcel lost in the post
  // looked exactly like one that got home and its owner was never asked.
  const handleConfirmReturnReceived = () =>
    runAction(
      "confirm-return-received",
      () => bookingsApi.confirmReturnReceived(booking.id),
      "Thanks - this delivery is now closed",
    );

  // ── Stages 8/9/10 ─────────────────────────────────────────────────────────
  // Ready to travel -> journey started -> landed. None of them move money; each
  // is a real signal the receiver is otherwise left guessing at.
  const handleConfirmReady = () =>
    runAction("confirm-ready", () => bookingsApi.confirmReadyToTravel(bookingId),
      "Your sender knows you're ready to travel");

  const handleStartJourney = () =>
    runAction("start-journey", () => bookingsApi.startJourney(bookingId),
      "Journey started - safe travels");

  const handleMarkLanded = () =>
    runAction("mark-landed", () => bookingsApi.markLanded(bookingId),
      "Your receiver has been asked to coordinate pickup");

  // Deliberately separate from cancelling: a delayed flight reschedules the trip
  // and the parcel stays exactly where it is.
  const handleReportDelay = (args: {
    reason: JourneyDelayReason;
    note?: string;
    new_travel_date?: string;
  }) =>
    runAction("report-delay", () => bookingsApi.reportDelay(bookingId, args),
      "Delay reported - your sender has been told");

  const handleAcceptHandoff = async () => {
    await runAction(
      "accept-handoff",
      () => bookingsApi.acceptHandoff(booking.id),
      // Names the next phase so the delivery-code field that now appears doesn't
      // read as "a code is required right now".
      "Handoff complete — you're in transit. Enter the receiver's code at the destination.",
    );
    setAcceptHandoffOpen(false);
  };

  const handleRejectHandoffConfirm = async (reason: string, withCarrier: boolean, file?: RNUploadFile) => {
    setModalError(null);
    const result = await runAction(
      "reject-handoff",
      async () => {
        // Upload evidence first (if attached), then pass its path on reject.
        let photo_path: string | undefined;
        if (file) {
          const up = await bookingsApi.uploadHandoffEvidence(booking.id, file);
          photo_path = up.path;
        }
        return bookingsApi.rejectHandoff(booking.id, { reason, photo_path, parcel_with_carrier: withCarrier });
      },
      "Parcel declined — sender refunded in full",
      undefined,
      setModalError,
    );
    if (result) setRejectHandoffOpen(false);
  };

  const handleCancelConfirm = async (reason: string) => {
    setModalError(null);
    const result = await runAction(
      "cancel",
      () => bookingsApi.cancel(booking.id, reason),
      "Booking cancelled",
      undefined,
      setModalError,
    );
    if (result) setCancelOpen(false);
  };

  const handleCancelPostPossessionConfirm = async (
    reason: string,
    answers?: { will_return: boolean; was_online_order: boolean; free_return_eligible: boolean },
  ) => {
    setModalError(null);
    const result = await runAction(
      "cancel-post-possession",
      () => bookingsApi.cancelPostPossession(booking.id, { reason, return_answers: answers }),
      "Cancelled mid-trip",
      (code, base) => {
        if (code === "RETURN_ADDRESS_REQUIRED")
          return "The sender has no return address on file — a returnable cancellation needs one first.";
        if (code === "STRIKE_LIMIT_REACHED")
          return "You’ve hit the cancellation strike limit and can’t cancel mid-trip.";
        return base;
      },
      setModalError,
    );
    if (!result) return;
    setCancelPostPossessionOpen(false);
    // Tier/penalty are server-driven — surface whatever the response reports.
    const data = result.data;
    if (data?.waiver_eligible) {
      showBanner(
        {
          variant: "info",
          title: "Return waiver opened",
          message: "The sender can waive the cash penalty — your strike still applies.",
        },
        7000,
      );
    } else if (typeof data?.penalty_amount === "number") {
      showBanner(
        {
          variant: "warning",
          title: `Penalty applied: ${formatMoney(data.penalty_amount, (data as { currency?: string }).currency)}`,
          message: `Tier: ${data.tier}. The sender has been refunded in full.`,
        },
        7000,
      );
    }
  };

  const handleGenerateOtp = async () => {
    const result = await runAction(
      "generate-otp",
      () => bookingsApi.generateOtp(booking.id),
      "Delivery code generated",
    );
    const otp = result?.data?.otp;
    if (otp) {
      setGeneratedOtp(otp);
      setOtpEmailed(!!result?.data?.emailed);
    }
  };

  const handleCopyOtp = async () => {
    if (!generatedOtp) return;
    await Clipboard.setStringAsync(generatedOtp);
    showBanner({ variant: "success", title: "Code copied to clipboard" }, 2400);
  };

  const handleConfirmOtp = async () => {
    const trimmed = otpCode.trim();
    if (trimmed.length === 0) return;
    const result = await runAction(
      "confirm-otp",
      () => bookingsApi.confirmOtp(booking.id, trimmed),
      "Delivery confirmed",
      (code, base) => {
        if (code === "RATE_LIMITED")
          return "Too many wrong codes. Ask the sender to tap Resend for a fresh code.";
        if (code === "UNAUTHENTICATED")
          return "That delivery code has expired. Ask the sender to resend a new one.";
        if (code === "CONFLICT")
          return "No delivery code has been generated yet. Ask the sender to generate one.";
        return base;
      },
    );
    if (result) setOtpCode("");
  };

  return {
    handleSetHandoffPlan,
    handleMarkHandoffSent,
    handleSetReturnResolution,
    handleCompleteReturn,
    handleConfirmReturnReceived,
    handleConfirmReady,
    handleStartJourney,
    handleMarkLanded,
    handleReportDelay,
    handleAcceptHandoff,
    handleRejectHandoffConfirm,
    handleCancelConfirm,
    handleCancelPostPossessionConfirm,
    handleGenerateOtp,
    handleCopyOtp,
    handleConfirmOtp,
  };
}

export type BookingActions = ReturnType<typeof createBookingActions>;
