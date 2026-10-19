/**
 * City lists used by the Search screen.
 *
 * Mirrors web's `src/lib/cityLists.ts` byte-for-byte so a city picked on
 * either platform round-trips through the same Supabase row. Change both
 * together.
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
  "Austin (AUS), TX",
  "Portland (PDX), OR",
  "Las Vegas (LAS), NV",
  "San Diego (SAN), CA",
  "Salt Lake City (SLC), UT",
  "Nashville (BNA), TN",
  "Tampa (TPA), FL",
  "Fort Lauderdale (FLL), FL",
  "Baltimore (BWI), MD",
  "Washington (DCA), DC",
  "New York (LGA), NY",
  "Chicago (MDW), IL",
  "Houston (HOU), TX",
  "Dallas (DAL), TX",
  "Raleigh-Durham (RDU), NC",
  "St. Louis (STL), MO",
  "Kansas City (MCI), MO",
  "Sacramento (SMF), CA",
  "Oakland (OAK), CA",
  "Santa Ana (SNA), CA",
  "San Antonio (SAT), TX",
  "New Orleans (MSY), LA",
  "Pittsburgh (PIT), PA",
  "Cleveland (CLE), OH",
  "Columbus (CMH), OH",
  "Cincinnati (CVG), KY",
  "Indianapolis (IND), IN",
  "Milwaukee (MKE), WI",
  "Jacksonville (JAX), FL",
  "Fort Myers (RSW), FL",
  "West Palm Beach (PBI), FL",
  "Hartford (BDL), CT",
  "Albuquerque (ABQ), NM",
  "Tucson (TUS), AZ",
  "Honolulu (HNL), HI",
  "Anchorage (ANC), AK",
  "Boise (BOI), ID",
  "Omaha (OMA), NE",
  "Oklahoma City (OKC), OK",
  "Louisville (SDF), KY",
  "Richmond (RIC), VA",
  "Charleston (CHS), SC",
  "Burbank (BUR), CA",
  "Ontario (ONT), CA",
  "Spokane (GEG), WA",
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
