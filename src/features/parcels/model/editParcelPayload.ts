import type { Parcel, parcelsApi } from "@/services/api";
import type { ReturnFieldsUpdate } from "@/utils/addressOptions";
import type { EditParcelFormValues } from "../EditParcelModal";

/**
 * What an Edit parcel save sends: only the fields that changed (28 Oct 2026
 * edit canon). My Travels and Parcel details each had their own copy.
 *
 * No runtime imports, so node:test can load it. "ANY" is CityPicker's
 * ANY_CITY sentinel (a test checks the two stay equal). The return block's
 * diff (returnFormChanges) is passed in, because the caller decides whether
 * the private return address has been loaded yet.
 */
const ANY_CITY = "ANY";

export type ParcelEditPayload = Parameters<typeof parcelsApi.update>[1];

export type ParcelEditStored = Pick<
  Parcel,
  | "from_city"
  | "to_city"
  | "from_country"
  | "to_country"
  | "any_from"
  | "any_to"
  | "weight_kg"
  | "description"
  | "category"
  | "fee_offered"
  | "fee_currency"
  | "delivery_by"
  | "delivery_by_from"
  | "delivery_by_to"
  | "delivery_date_mode"
>;

const countryOf = (c: string | null | undefined): "IN" | "US" =>
  (c ?? "").toUpperCase() === "US" ? "US" : "IN";

/** The form's starting values for a stored parcel (return block passed in, see above). */
export function parcelEditInitial(
  parcel: ParcelEditStored,
  returnForm: EditParcelFormValues["returnForm"],
): EditParcelFormValues {
  return {
    from_city: parcel.any_from ? ANY_CITY : (parcel.from_city ?? ""),
    from_country: countryOf(parcel.from_country),
    to_city: parcel.any_to ? ANY_CITY : (parcel.to_city ?? ""),
    to_country: countryOf(parcel.to_country),
    weight_kg: `${parcel.weight_kg ?? ""}`,
    description: parcel.description ?? "",
    category: (parcel.category as EditParcelFormValues["category"]) || "personal",
    fee_offered: `${parcel.fee_offered ?? ""}`,
    fee_currency: parcel.fee_currency === "INR" ? "INR" : "USD",
    // Trust the persisted mode rather than inferring it from the dates.
    delivery_by_from: parcel.delivery_by_from ?? parcel.delivery_by ?? "",
    delivery_by_to: parcel.delivery_by_to ?? parcel.delivery_by ?? "",
    delivery_date_mode: parcel.delivery_date_mode === "range" ? "range" : "single",
    returnForm,
  };
}

export function parcelEditPayload(
  values: EditParcelFormValues,
  parcel: ParcelEditStored,
  returnChanges: ReturnFieldsUpdate,
): ParcelEditPayload {
  const data: ParcelEditPayload = {};

  const fromCity = values.from_city === ANY_CITY ? "Any" : values.from_city;
  const toCity = values.to_city === ANY_CITY ? "Any" : values.to_city;
  const curFromCity = parcel.any_from ? "Any" : parcel.from_city;
  const curToCity = parcel.any_to ? "Any" : parcel.to_city;
  if (fromCity !== curFromCity || values.from_country !== countryOf(parcel.from_country)) {
    data.from_city = fromCity;
    data.from_country = values.from_country;
    data.any_from = values.from_city === ANY_CITY;
  }
  if (toCity !== curToCity || values.to_country !== countryOf(parcel.to_country)) {
    data.to_city = toCity;
    data.to_country = values.to_country;
    data.any_to = values.to_city === ANY_CITY;
  }

  const weightNum = Number(values.weight_kg);
  if (values.weight_kg !== "" && Number.isFinite(weightNum) && weightNum !== parcel.weight_kg) {
    data.weight_kg = weightNum;
  }
  if (values.description !== (parcel.description ?? "")) {
    data.description = values.description;
  }
  if (values.category && values.category !== parcel.category) {
    data.category = values.category;
  }
  const feeNum = Number(values.fee_offered);
  if (values.fee_offered !== "" && Number.isFinite(feeNum) && feeNum !== parcel.fee_offered) {
    data.fee_offered = feeNum;
  }
  if (values.fee_currency !== parcel.fee_currency) {
    data.fee_currency = values.fee_currency;
  }

  // Dates travel as a set: the PUT handler does not default
  // delivery_date_mode, so a date change without it can leave mode="single"
  // with from != to.
  const curFrom = parcel.delivery_by_from ?? parcel.delivery_by ?? "";
  const curTo = parcel.delivery_by_to ?? parcel.delivery_by ?? "";
  const curMode = parcel.delivery_date_mode === "range" ? "range" : "single";
  if (
    values.delivery_by_from !== curFrom ||
    values.delivery_by_to !== curTo ||
    values.delivery_date_mode !== curMode
  ) {
    data.delivery_date_mode = values.delivery_date_mode;
    data.delivery_by_from = values.delivery_by_from;
    data.delivery_by_to = values.delivery_by_to;
    data.delivery_by = values.delivery_by_to;
  }

  // Online order / return block: only what changed (27 Oct 2026).
  Object.assign(data, returnChanges);
  return data;
}
