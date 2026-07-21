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
  { code: "SA", name: "Saudi Arabia" },
  { code: "AE", name: "UAE" },
  { code: "GB", name: "United Kingdom" },
  { code: "CA", name: "Canada" },
  { code: "FR", name: "France" },
  { code: "DE", name: "Germany" },
  { code: "TR", name: "Turkey" },
  { code: "EG", name: "Egypt" },
  { code: "JO", name: "Jordan" },
  { code: "PK", name: "Pakistan" },
  { code: "BD", name: "Bangladesh" },
  { code: "AU", name: "Australia" },
  { code: "SG", name: "Singapore" },
  { code: "MY", name: "Malaysia" },
] as const;

/**
 * The shorter list offered during first-run profile setup.
 *
 * Mirrors web's onboarding step (`CustomerOnboarding.tsx`), which hardcodes
 * just these two — the launch markets. Edit Profile deliberately keeps the
 * full `COUNTRIES` list on both platforms, so a user can widen their choice
 * later; this only keeps the initial signup decision simple.
 *
 * Derived from COUNTRIES rather than re-declared so the names and ISO codes
 * can't drift apart.
 */
export const ONBOARDING_COUNTRY_CODES = ["US", "IN"] as const;

export const ONBOARDING_COUNTRIES: readonly CountryOption[] = COUNTRIES.filter((c) =>
  (ONBOARDING_COUNTRY_CODES as readonly string[]).includes(c.code),
);

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
