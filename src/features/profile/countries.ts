/**
 * Countries selectable in profile forms.
 *
 * Order and ISO codes intentionally mirror the web app
 * (`web app/safarly_web/src/customer/pages/CustomerEditProfile.tsx`) so the
 * same value round-trips between platforms unchanged.
 */
export interface CountryOption {
  code: string;
  name: string;
}

export const COUNTRIES: readonly CountryOption[] = [
  { code: "US", name: "United States" },
  { code: "IN", name: "India" },
] as const;

/**
 * The country list offered during first-run profile setup — identical to the
 * full list now that both markets are the only supported ones (web parity:
 * web's Edit Profile also hardcodes just US + IN). Kept as a separate export so
 * onboarding can diverge again later without touching its call sites.
 */
export const ONBOARDING_COUNTRIES: readonly CountryOption[] = COUNTRIES;

const NAME_BY_CODE: Readonly<Record<string, string>> = COUNTRIES.reduce<Record<string, string>>(
  (acc, c) => {
    acc[c.code] = c.name;
    return acc;
  },
  {},
);

/** Display name for a stored country value (ISO code or already a name). */
export function countryLabel(value: string | null | undefined): string {
  if (!value) return "";
  return NAME_BY_CODE[value] ?? value;
}
