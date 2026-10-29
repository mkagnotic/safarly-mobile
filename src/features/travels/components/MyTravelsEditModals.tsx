import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { buddyEditInitial } from "@/features/buddies/editBuddyPayload";
import { EditBuddyListingModal } from "@/features/buddies/EditBuddyListingModal";
import { RateBuddyModal } from "@/features/buddies/RateBuddyModal";
import { EditParcelModal } from "@/features/parcels/EditParcelModal";
import { parcelEditInitial } from "@/features/parcels/model/editParcelPayload";
import { EditTripModal } from "@/features/trips/EditTripModal";
import { tripEditInitial } from "@/features/trips/model/editTripPayload";
import { returnFormFromParcel } from "@/utils/addressOptions";
import type { MyTravelsActions } from "@/features/travels/hooks/useMyTravelsActions";

type MyTravelsEditModalsProps = Pick<
  MyTravelsActions,
  | "editingTrip"
  | "editPending"
  | "editTripError"
  | "handleEditTripCancel"
  | "handleEditTripSubmit"
  | "ratingConn"
  | "ratePending"
  | "handleRateCancel"
  | "handleRateSubmit"
  | "editingParcel"
  | "editParcelPending"
  | "editParcelError"
  | "editParcelDetail"
  | "handleEditParcelCancel"
  | "handleEditParcelSubmit"
  | "editingBuddy"
  | "editBuddyPending"
  | "editBuddyError"
  | "handleEditBuddyCancel"
  | "handleEditBuddySubmit"
>;

/** The edit-trip / rate-buddy / edit-parcel / edit-buddy modals, each mounted only while open. */
export function MyTravelsEditModals({
  editingTrip,
  editPending,
  editTripError,
  handleEditTripCancel,
  handleEditTripSubmit,
  ratingConn,
  ratePending,
  handleRateCancel,
  handleRateSubmit,
  editingParcel,
  editParcelPending,
  editParcelError,
  editParcelDetail,
  handleEditParcelCancel,
  handleEditParcelSubmit,
  editingBuddy,
  editBuddyPending,
  editBuddyError,
  handleEditBuddyCancel,
  handleEditBuddySubmit,
}: Readonly<MyTravelsEditModalsProps>) {
  return (
    <>
      {editingTrip ? (
        <EditTripModal
          open
          listingId={editingTrip.id}
          initial={tripEditInitial(editingTrip)}
          pending={editPending}
          serverError={editTripError}
          onCancel={handleEditTripCancel}
          onSubmit={handleEditTripSubmit}
        />
      ) : null}

      {ratingConn ? (
        <RateBuddyModal
          open
          buddyName={ratingConn.buddy?.name ?? "Traveler"}
          fromCity={ratingConn.from_city}
          toCity={ratingConn.to_city}
          pending={ratePending}
          onCancel={handleRateCancel}
          onSubmit={handleRateSubmit}
        />
      ) : null}

      {editingParcel ? (
        <EditParcelModal
          open
          listingId={editingParcel.id}
          // The return block prefills from the owner's detail read (the list row has no
          // street / postal code / order number); the currency lock comes with it too.
          initial={parcelEditInitial(
            editingParcel,
            returnFormFromParcel(editParcelDetail ?? editingParcel),
          )}
          pending={editParcelPending}
          serverError={editParcelError}
          detailPending={!editParcelDetail}
          currencyLocked={!!editParcelDetail?.currency_locked}
          onCancel={handleEditParcelCancel}
          onSubmit={handleEditParcelSubmit}
        />
      ) : null}

      {editingBuddy ? (
        <EditBuddyListingModal
          open
          initial={buddyEditInitial(editingBuddy, { india: INDIA_CITIES, usa: USA_CITIES })}
          pending={editBuddyPending}
          serverError={editBuddyError}
          onCancel={handleEditBuddyCancel}
          onSubmit={handleEditBuddySubmit}
        />
      ) : null}
    </>
  );
}
