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
