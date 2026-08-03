/**
 * Country / state options and address validation for the return-address form.
 * Mirrors web's `src/lib/addressOptions.ts` — keep the two in step.
 *
 * The return address was previously free-text boxes with NO validation and no
 * country field at all — "test" in every box was accepted, and `return_country`
 * was never sent even though the column exists and the return flow needs it. A
 * return address that cannot be posted to is worthless exactly when it matters:
 * a carrier has cancelled and is holding someone's parcel.
 */

export interface AddressOption {
  value: string;
  label: string;
}

export const RETURN_COUNTRIES: readonly AddressOption[] = [
  { value: "US", label: "United States" },
  { value: "IN", label: "India" },
] as const;

const US_STATES: readonly AddressOption[] = [
  ["AL", "Alabama"], ["AK", "Alaska"], ["AZ", "Arizona"], ["AR", "Arkansas"],
  ["CA", "California"], ["CO", "Colorado"], ["CT", "Connecticut"], ["DE", "Delaware"],
  ["DC", "District of Columbia"], ["FL", "Florida"], ["GA", "Georgia"], ["HI", "Hawaii"],
  ["ID", "Idaho"], ["IL", "Illinois"], ["IN", "Indiana"], ["IA", "Iowa"],
  ["KS", "Kansas"], ["KY", "Kentucky"], ["LA", "Louisiana"], ["ME", "Maine"],
  ["MD", "Maryland"], ["MA", "Massachusetts"], ["MI", "Michigan"], ["MN", "Minnesota"],
  ["MS", "Mississippi"], ["MO", "Missouri"], ["MT", "Montana"], ["NE", "Nebraska"],
  ["NV", "Nevada"], ["NH", "New Hampshire"], ["NJ", "New Jersey"], ["NM", "New Mexico"],
  ["NY", "New York"], ["NC", "North Carolina"], ["ND", "North Dakota"], ["OH", "Ohio"],
  ["OK", "Oklahoma"], ["OR", "Oregon"], ["PA", "Pennsylvania"], ["RI", "Rhode Island"],
  ["SC", "South Carolina"], ["SD", "South Dakota"], ["TN", "Tennessee"], ["TX", "Texas"],
  ["UT", "Utah"], ["VT", "Vermont"], ["VA", "Virginia"], ["WA", "Washington"],
  ["WV", "West Virginia"], ["WI", "Wisconsin"], ["WY", "Wyoming"],
].map(([value, label]) => ({ value, label }));

const IN_STATES: readonly AddressOption[] = [
  ["AN", "Andaman and Nicobar Islands"], ["AP", "Andhra Pradesh"],
  ["AR", "Arunachal Pradesh"], ["AS", "Assam"], ["BR", "Bihar"], ["CH", "Chandigarh"],
  ["CT", "Chhattisgarh"], ["DH", "Dadra and Nagar Haveli and Daman and Diu"],
  ["DL", "Delhi"], ["GA", "Goa"], ["GJ", "Gujarat"], ["HR", "Haryana"],
  ["HP", "Himachal Pradesh"], ["JK", "Jammu and Kashmir"], ["JH", "Jharkhand"],
  ["KA", "Karnataka"], ["KL", "Kerala"], ["LA", "Ladakh"], ["LD", "Lakshadweep"],
  ["MP", "Madhya Pradesh"], ["MH", "Maharashtra"], ["MN", "Manipur"],
  ["ML", "Meghalaya"], ["MZ", "Mizoram"], ["NL", "Nagaland"], ["OD", "Odisha"],
  ["PY", "Puducherry"], ["PB", "Punjab"], ["RJ", "Rajasthan"], ["SK", "Sikkim"],
  ["TN", "Tamil Nadu"], ["TG", "Telangana"], ["TR", "Tripura"],
  ["UP", "Uttar Pradesh"], ["UK", "Uttarakhand"], ["WB", "West Bengal"],
].map(([value, label]) => ({ value, label }));

const STATES_BY_COUNTRY: Readonly<Record<string, readonly AddressOption[]>> = {
  US: US_STATES,
  IN: IN_STATES,
};

export function statesFor(country: string): readonly AddressOption[] {
  return STATES_BY_COUNTRY[country] ?? [];
}

export function labelForState(country: string, code: string): string {
  return statesFor(country).find((s) => s.value === code)?.label ?? "";
}

export function labelForCountry(code: string): string {
  return RETURN_COUNTRIES.find((c) => c.value === code)?.label ?? "";
}

const POSTAL_RULES: Record<string, { pattern: RegExp; hint: string }> = {
  US: { pattern: /^\d{5}(-\d{4})?$/, hint: "US ZIP codes are 5 digits (or ZIP+4)." },
  IN: { pattern: /^\d{6}$/, hint: "Indian PIN codes are 6 digits." },
};

export function postalHint(country: string): string | null {
  return POSTAL_RULES[country]?.hint ?? null;
}

export interface ReturnAddressInput {
  line1: string;
  city: string;
  state: string;
  postal: string;
  country: string;
}

export type ReturnAddressErrors = Partial<Record<keyof ReturnAddressInput, string>>;

/**
 * Every field except line 2 and the order reference is required — a partial
 * address cannot be posted to. Mirrored server-side in parcel-handler; this is
 * UX, not enforcement.
 */
export function validateReturnAddress(input: ReturnAddressInput): ReturnAddressErrors {
  const errors: ReturnAddressErrors = {};
  const line1 = input.line1.trim();
  const city = input.city.trim();
  const postal = input.postal.trim();

  if (line1.length < 4) errors.line1 = "Enter the street address.";
  if (city.length < 2) errors.city = "Enter the city.";
  if (!input.country) errors.country = "Select a country.";

  if (!input.state) {
    errors.state = "Select a state.";
  } else if (input.country && !statesFor(input.country).some((s) => s.value === input.state)) {
    // Guards the country-changed-after-state case, which would otherwise submit
    // a state that does not exist in the selected country.
    errors.state = "Select a state in the chosen country.";
  }

  if (!postal) {
    errors.postal = "Enter the postal code.";
  } else {
    const rule = POSTAL_RULES[input.country];
    if (rule && !rule.pattern.test(postal)) errors.postal = rule.hint;
  }

  return errors;
}

/** ISO-2 code from either the code or the display name ("India" -> "IN"). */
export function countryCode(value: string | null | undefined): string {
  const v = (value ?? "").trim();
  if (!v) return "";
  if (RETURN_COUNTRIES.some((c) => c.value === v)) return v;
  return RETURN_COUNTRIES.find((c) => c.label.toLowerCase() === v.toLowerCase())?.value ?? "";
}

/**
 * Digits, spaces and the usual punctuation, 7-15 digits — E.164 allows up to 15
 * and no real number has fewer than 7. Deliberately not stricter: the number is
 * printed on a label for a courier to ring, not dialled by us.
 */
const PHONE_DIGITS = /^\+?[\d\s().-]+$/;

/**
 * Strip what a postal code can never contain, as it is typed.
 *
 * `keyboardType="number-pad"` only picks the DEFAULT keyboard — a hardware
 * keyboard, a paste, or a third-party IME can still put letters in the field, so
 * the value has to be filtered rather than merely hinted. Hyphen is kept for
 * US ZIP+4. Keep in sync with web's `lib/addressOptions.ts`.
 */
export function sanitisePostal(value: string): string {
  return value.replace(/[^\d-]/g, "");
}

/** Same idea for a phone number: digits and the punctuation people really use. */
export function sanitisePhone(value: string): string {
  return value.replace(/[^\d+\s().-]/g, "");
}

export interface CourierAddressInput extends ReturnAddressInput {
  contactName: string;
  contactPhone: string;
}

export type CourierAddressErrors = Partial<Record<keyof CourierAddressInput, string>>;

/**
 * A COURIER address: the return-address rules plus the two fields a courier
 * needs to hand the parcel over. Keep in sync with web's `lib/addressOptions.ts`.
 *
 * The handoff form had no format checks at all — free-text country and state,
 * and nothing to stop a postal code that cannot exist — even though the address
 * it produces is what a sender posts a real parcel to.
 */
export function validateCourierAddress(input: CourierAddressInput): CourierAddressErrors {
  const errors: CourierAddressErrors = validateReturnAddress(input);
  const name = input.contactName.trim();
  const phone = input.contactPhone.trim();
  const digits = phone.replace(/\D/g, "");

  if (name.length < 2) errors.contactName = "Enter the name the parcel is addressed to.";

  if (!phone) {
    errors.contactPhone = "Enter a phone number for the courier.";
  } else if (!PHONE_DIGITS.test(phone) || digits.length < 7 || digits.length > 15) {
    errors.contactPhone = "Enter a valid phone number the courier can call.";
  }

  return errors;
}
