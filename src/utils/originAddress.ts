/**
 * Split a listing's origin into the parts a courier address form needs.
 *
 * Routes are stored as ONE string - `parcel_requests.from_city` looks like
 * "Mumbai, MH" or "Chicago (ORD), IL" - with the country separately as an ISO-2
 * code in `from_country`. The handoff form previously dropped that whole string
 * into its City box, so a carrier saw "Mumbai, MH" under City with State and
 * Country blank and had to retype what the system already knew.
 *
 * Web parity: `src/lib/originAddress.ts`.
 */

/** ISO-2 -> display name, for the countries Safarly actually operates in.
 *  Anything else falls through to the raw code, which is still unambiguous on a
 *  shipping label. */
const COUNTRY_NAMES: Record<string, string> = {
  IN: "India",
  US: "United States",
  GB: "United Kingdom",
  UK: "United Kingdom",
  AE: "United Arab Emirates",
  CA: "Canada",
  AU: "Australia",
  SG: "Singapore",
  DE: "Germany",
  FR: "France",
  NL: "Netherlands",
  QA: "Qatar",
  SA: "Saudi Arabia",
  MY: "Malaysia",
  LK: "Sri Lanka",
  NP: "Nepal",
  BD: "Bangladesh",
  PK: "Pakistan",
};

export interface OriginParts {
  /** City with any airport code stripped, e.g. "Chicago". */
  city: string;
  /** Region/state as listed, e.g. "MH" / "IL". Empty when the origin had none. */
  state: string;
  /** Display country name where known, otherwise the raw code. */
  country: string;
}

/**
 * @param fromCity e.g. "Mumbai, MH" | "Chicago (ORD), IL" | "Dubai"
 * @param fromCountry ISO-2 code, e.g. "IN"
 */
export function parseOrigin(
  fromCity: string | null | undefined,
  fromCountry?: string | null,
): OriginParts {
  const raw = (fromCity ?? "").trim();
  const country = (() => {
    const code = (fromCountry ?? "").trim();
    if (!code) return "";
    return COUNTRY_NAMES[code.toUpperCase()] ?? code;
  })();

  if (!raw) return { city: "", state: "", country };

  // Split on the LAST comma: "Chicago (ORD), IL" -> ["Chicago (ORD)", "IL"].
  // A city containing its own comma is far likelier than a two-part region.
  const lastComma = raw.lastIndexOf(",");
  let cityPart = raw;
  let state = "";
  if (lastComma > 0) {
    const tail = raw.slice(lastComma + 1).trim();
    // Only treat the tail as a region if it looks like one. A long tail is more
    // likely a second city name than a state, so leave it in the city.
    if (tail && tail.length <= 20) {
      cityPart = raw.slice(0, lastComma).trim();
      state = tail;
    }
  }

  // Strip a trailing airport code: "Chicago (ORD)" -> "Chicago".
  const city = cityPart.replace(/\s*\([^)]*\)\s*$/, "").trim();

  return { city, state, country };
}
