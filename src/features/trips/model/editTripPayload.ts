import type { Trip, tripsApi } from "@/services/api";
import type { EditTripFormValues } from "../EditTripModal";

/**
 * What an Edit trip save sends: only the fields that changed (28 Oct 2026 edit
 * canon). My Travels and Trip details each had their own copy of this diff.
 *
 * No runtime imports, so node:test can load it. "ANY" is CityPicker's
 * ANY_CITY sentinel (a test checks the two stay equal).
 */
const ANY_CITY = "ANY";

export type TripEditPayload = Parameters<typeof tripsApi.update>[1];

export type TripEditStored = Pick<
  Trip,
  "from_city" | "to_city" | "from_country" | "to_country" | "luggage_capacity_kg"
> &
  Partial<Pick<Trip, "any_from" | "any_to" | "travel_date" | "travel_date_from" | "travel_date_to" | "open_to_buddy">>;

const countryOf = (c: string | null | undefined): "IN" | "US" =>
  (c ?? "").toUpperCase() === "US" ? "US" : "IN";

/** The form's starting values for a stored trip. */
export function tripEditInitial(trip: TripEditStored): EditTripFormValues {
  return {
    from_city: trip.any_from ? ANY_CITY : (trip.from_city ?? ""),
    from_country: countryOf(trip.from_country),
    to_city: trip.any_to ? ANY_CITY : (trip.to_city ?? ""),
    to_country: countryOf(trip.to_country),
    travel_date_from: trip.travel_date_from ?? trip.travel_date ?? "",
    luggage_capacity_kg: `${trip.luggage_capacity_kg ?? ""}`,
    open_to_buddy: !!trip.open_to_buddy,
  };
}

export function tripEditPayload(values: EditTripFormValues, trip: TripEditStored): TripEditPayload {
  const data: TripEditPayload = {};

  const fromCity = values.from_city === ANY_CITY ? "Any" : values.from_city;
  const toCity = values.to_city === ANY_CITY ? "Any" : values.to_city;
  const curFromCity = trip.any_from ? "Any" : trip.from_city;
  const curToCity = trip.any_to ? "Any" : trip.to_city;
  if (fromCity !== curFromCity || values.from_country !== countryOf(trip.from_country)) {
    data.from_city = fromCity;
    data.from_country = values.from_country;
    data.any_from = values.from_city === ANY_CITY;
  }
  if (toCity !== curToCity || values.to_country !== countryOf(trip.to_country)) {
    data.to_city = toCity;
    data.to_country = values.to_country;
    data.any_to = values.to_city === ANY_CITY;
  }

  // Single travel date, as List trip and web (28 Oct 2026: "Return" removed).
  // Sent only when the date itself changed, so an untouched older trip keeps
  // its stored end date and a booked trip isn't refused for a date it kept.
  const from = values.travel_date_from;
  const storedFrom = trip.travel_date_from ?? trip.travel_date ?? "";
  if (from && from !== storedFrom) {
    data.travel_date = from;
    data.travel_date_from = from;
    data.travel_date_to = from;
  }

  const capacityNum = Number(values.luggage_capacity_kg);
  if (
    values.luggage_capacity_kg !== "" &&
    Number.isFinite(capacityNum) &&
    capacityNum !== trip.luggage_capacity_kg
  ) {
    data.luggage_capacity_kg = capacityNum;
  }
  // Sent only when changed (27 Oct 2026): off retires the buddy listing, on creates one.
  if (values.open_to_buddy !== !!trip.open_to_buddy) {
    data.open_to_buddy = values.open_to_buddy;
  }
  return data;
}
