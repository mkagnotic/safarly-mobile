import { ANY_CITY } from "@/features/search/CityPicker";
import { INDIA_CITIES, USA_CITIES } from "@/features/search/cityLists";
import { EditBuddyListingModal } from "@/features/buddies/EditBuddyListingModal";
import { RateBuddyModal } from "@/features/buddies/RateBuddyModal";
import { EditParcelModal, type EditParcelFormValues } from "@/features/parcels/EditParcelModal";
import { EditTripModal } from "@/features/trips/EditTripModal";
import type { MyTravelsActions } from "@/features/travels/hooks/useMyTravelsActions";

type MyTravelsEditModalsProps = Pick<
  MyTravelsActions,
  | "editingTrip"
  | "editPending"
  | "handleEditTripCancel"
  | "handleEditTripSubmit"
  | "ratingConn"
  | "ratePending"
  | "handleRateCancel"
  | "handleRateSubmit"
  | "editingParcel"
  | "editParcelPending"
  | "handleEditParcelCancel"
  | "handleEditParcelSubmit"
  | "editingBuddy"
  | "editBuddyPending"
  | "handleEditBuddyCancel"
  | "handleEditBuddySubmit"
>;

/** The edit-trip / rate-buddy / edit-parcel / edit-buddy modals, each mounted only while open. */
export function MyTravelsEditModals({
  editingTrip,
  editPending,
  handleEditTripCancel,
  handleEditTripSubmit,
  ratingConn,
  ratePending,
  handleRateCancel,
  handleRateSubmit,
  editingParcel,
  editParcelPending,
  handleEditParcelCancel,
  handleEditParcelSubmit,
  editingBuddy,
  editBuddyPending,
  handleEditBuddyCancel,
  handleEditBuddySubmit,
}: Readonly<MyTravelsEditModalsProps>) {
  return (
    <>
      {editingTrip ? (
        <EditTripModal
          open
          listingId={editingTrip.id}
          initial={{
            from_city: editingTrip.any_from ? ANY_CITY : (editingTrip.from_city ?? ""),
            from_country: (editingTrip.from_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            to_city: editingTrip.any_to ? ANY_CITY : (editingTrip.to_city ?? ""),
            to_country: (editingTrip.to_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            travel_date_from: editingTrip.travel_date_from ?? editingTrip.travel_date ?? "",
            travel_date_to:
              editingTrip.travel_date_to &&
              editingTrip.travel_date_to !== (editingTrip.travel_date_from ?? editingTrip.travel_date)
                ? editingTrip.travel_date_to
                : "",
            luggage_capacity_kg: `${editingTrip.luggage_capacity_kg ?? ""}`,
            notes: editingTrip.notes ?? "",
            open_to_buddy: !!editingTrip.open_to_buddy,
          }}
          pending={editPending}
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
          initial={{
            from_city: editingParcel.any_from ? ANY_CITY : (editingParcel.from_city ?? ""),
            from_country: (editingParcel.from_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            to_city: editingParcel.any_to ? ANY_CITY : (editingParcel.to_city ?? ""),
            to_country: (editingParcel.to_country ?? "").toUpperCase() === "US" ? "US" : "IN",
            weight_kg: `${editingParcel.weight_kg ?? ""}`,
            description: editingParcel.description ?? "",
            category:
              (editingParcel.category as EditParcelFormValues["category"]) ?? "personal",
            fee_offered: `${editingParcel.fee_offered ?? ""}`,
            fee_currency: editingParcel.fee_currency === "INR" ? "INR" : "USD",
            // Trust the persisted mode rather than inferring it from the dates.
            delivery_by_from:
              editingParcel.delivery_by_from ?? editingParcel.delivery_by ?? "",
            delivery_by_to: editingParcel.delivery_by_to ?? editingParcel.delivery_by ?? "",
            delivery_date_mode:
              editingParcel.delivery_date_mode === "range" ? "range" : "single",
          }}
          pending={editParcelPending}
          onCancel={handleEditParcelCancel}
          onSubmit={handleEditParcelSubmit}
        />
      ) : null}

      {editingBuddy ? (
        <EditBuddyListingModal
          open
          initial={{
            from_city: editingBuddy.from_city === "Any" ? ANY_CITY : editingBuddy.from_city,
            from_country: USA_CITIES.includes(editingBuddy.from_city) ? "US" : "IN",
            to_city: editingBuddy.to_city === "Any" ? ANY_CITY : editingBuddy.to_city,
            to_country: INDIA_CITIES.includes(editingBuddy.to_city) ? "IN" : "US",
            travel_date: editingBuddy.travel_date_from ?? editingBuddy.travel_date ?? "",
            airline: editingBuddy.airline ?? "",
            age: editingBuddy.age != null ? String(editingBuddy.age) : "",
            languages: editingBuddy.languages ?? [],
            interests: editingBuddy.interests ?? "",
            layover: editingBuddy.layover ?? "",
            bio: editingBuddy.bio ?? "",
          }}
          pending={editBuddyPending}
          onCancel={handleEditBuddyCancel}
          onSubmit={handleEditBuddySubmit}
        />
      ) : null}
    </>
  );
}
