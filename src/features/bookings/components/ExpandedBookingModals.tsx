import type { Booking } from "@/services/api";
import { AcceptHandoffModal } from "@/features/bookings/components/AcceptHandoffModal";
import { CancelBookingModal } from "@/features/bookings/components/CancelBookingModal";
import {
  CancelPostPossessionModal,
} from "@/features/bookings/components/CancelPostPossessionModal";
import { RejectHandoffModal } from "@/features/bookings/components/RejectHandoffModal";
import type { ExpandedBookingState } from "@/features/bookings/hooks/useExpandedBooking";
import type { BookingActions } from "@/features/bookings/lib/bookingActions";

type ExpandedBookingModalsProps = Pick<
  ExpandedBookingState,
  | "actionPending"
  | "modalError"
  | "setModalError"
  | "cancelOpen"
  | "setCancelOpen"
  | "acceptHandoffOpen"
  | "setAcceptHandoffOpen"
  | "rejectHandoffOpen"
  | "setRejectHandoffOpen"
  | "cancelPostPossessionOpen"
  | "setCancelPostPossessionOpen"
> &
  Pick<
    BookingActions,
    | "handleCancelConfirm"
    | "handleAcceptHandoff"
    | "handleRejectHandoffConfirm"
    | "handleCancelPostPossessionConfirm"
  > & { booking: Booking; returnEligible: boolean };

/**
 * The expanded card's four confirmation modals. A failed action is shown inside
 * the modal that ran it (`modalError`), which stays open so the user can retry.
 */
export function ExpandedBookingModals({
  booking,
  actionPending,
  modalError,
  setModalError,
  cancelOpen,
  setCancelOpen,
  handleCancelConfirm,
  acceptHandoffOpen,
  setAcceptHandoffOpen,
  handleAcceptHandoff,
  rejectHandoffOpen,
  setRejectHandoffOpen,
  handleRejectHandoffConfirm,
  cancelPostPossessionOpen,
  setCancelPostPossessionOpen,
  handleCancelPostPossessionConfirm,
  returnEligible,
}: Readonly<ExpandedBookingModalsProps>) {
  return (
    <>
      <CancelBookingModal
        open={cancelOpen}
        pending={actionPending === "cancel"}
        error={modalError}
        onCancel={() => {
          setModalError(null);
          setCancelOpen(false);
        }}
        onConfirm={handleCancelConfirm}
      />

      <AcceptHandoffModal
        open={acceptHandoffOpen}
        pending={actionPending === "accept-handoff"}
        onCancel={() => setAcceptHandoffOpen(false)}
        onConfirm={() => void handleAcceptHandoff()}
      />

      <RejectHandoffModal
        open={rejectHandoffOpen}
        pending={actionPending === "reject-handoff"}
        parcelLikelyWithCarrier={
          booking.handoff_mode === "shipped" && !!booking.handoff_dispatched_at
        }
        returnEligible={returnEligible}
        error={modalError}
        onCancel={() => {
          setModalError(null);
          setRejectHandoffOpen(false);
        }}
        onConfirm={handleRejectHandoffConfirm}
      />

      <CancelPostPossessionModal
        open={cancelPostPossessionOpen}
        pending={actionPending === "cancel-post-possession"}
        parcelIsReturnEligible={returnEligible}
        error={modalError}
        onCancel={() => {
          setModalError(null);
          setCancelPostPossessionOpen(false);
        }}
        onConfirm={handleCancelPostPossessionConfirm}
      />
    </>
  );
}
