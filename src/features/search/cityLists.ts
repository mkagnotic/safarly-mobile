/**
 * City lists used by the Search screen.
 *
 * Ported byte-for-byte from
 * `web app/safarly_web/src/customer/pages/CustomerSearch.tsx` so a city
 * picked on either platform round-trips through the same Supabase row.
 */

export const INDIA_CITIES: readonly string[] = [
  "Mumbai, MH",
  "Delhi, DL",
  "Bangalore, KA",
  "Hyderabad, TS",
  "Chennai, TN",
  "Kolkata, WB",
  "Ahmedabad, GJ",
  "Pune, MH",
  "Kochi, KL",
  "Goa, GA",
  "Jaipur, RJ",
  "Lucknow, UP",
  "Chandigarh, CH",
  "Thiruvananthapuram, KL",
  "Amritsar, PB",
  "Coimbatore, TN",
  "Nagpur, MH",
  "Varanasi, UP",
  "Mangalore, KA",
  "Calicut, KL",
] as const;

export const USA_CITIES: readonly string[] = [
  "New York (JFK), NY",
  "Newark (EWR), NJ",
  "Los Angeles (LAX), CA",
  "San Francisco (SFO), CA",
  "Chicago (ORD), IL",
  "Houston (IAH), TX",
  "Dallas (DFW), TX",
  "Washington (IAD), DC",
  "Atlanta (ATL), GA",
  "Seattle (SEA), WA",
  "Boston (BOS), MA",
  "Miami (MIA), FL",
  "Detroit (DTW), MI",
  "Minneapolis (MSP), MN",
  "Philadelphia (PHL), PA",
  "San Jose (SJC), CA",
  "Denver (DEN), CO",
  "Orlando (MCO), FL",
  "Charlotte (CLT), NC",
  "Phoenix (PHX), AZ",
] as const;

export type Direction = "IN_TO_US" | "US_TO_IN";

export function citiesForDirection(direction: Direction, side: "from" | "to"): readonly string[] {
  if (direction === "IN_TO_US") {
    return side === "from" ? INDIA_CITIES : USA_CITIES;
  }
  return side === "from" ? USA_CITIES : INDIA_CITIES;
}

export function countryLabelForDirection(direction: Direction, side: "from" | "to"): string {
  if (direction === "IN_TO_US") {
    return side === "from" ? "India" : "USA";
  }
  return side === "from" ? "USA" : "India";
}
