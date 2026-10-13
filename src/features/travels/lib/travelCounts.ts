import { api } from "@/services/api";

/**
 * My Travels tab counts - exact, from the server, the SAME numbers web shows.
 *
 * The labels used to be counted on the device from whatever had loaded:
 * Packages was the live rows of a 20-row page, Partners counted only your
 * posts (web counted requests and connections too), Archive used a page capped
 * at 50. The server now owns ONE definition per tab (`fn_my_travel_counts`,
 * supabase/functions/_shared/myTravels.ts in the web repo):
 *
 *   flights   my trips that are not finished and whose last travel day has not passed
 *   packages  parcels I send + parcels I deliver that are still live (date not
 *             passed, or a booking on them is still under way)
 *   partners  my live buddy posts + pending requests received + pending requests
 *             sent + buddy connections still under way
 *   archive   archived trips + delivered bookings + completed/rated buddies +
 *             past packages + past buddy posts
 *
 * The tab lists use the server filters below, which page through the same SQL,
 * so each label always matches its list.
 */
export interface MyTravelCounts {
  flights: number;
  packages: number;
  partners: number;
  archive: number;
  breakdown: Record<string, number>;
}

export const TRAVEL_COUNTS_PATH = "/user-handler/me/travel-counts";

export async function fetchMyTravelCounts(): Promise<MyTravelCounts> {
  const res = await api.get<MyTravelCounts>(TRAVEL_COUNTS_PATH);
  return res.data;
}

/** List filters backed by the same SQL as the counts. */
export const MY_TRAVELS_FILTERS = {
  sending: "my_parcels_active",
  delivering: "my_delivering_active",
  pastPackages: "my_packages_past",
  partnerPosts: "my_listings_active",
  pastPartnerPosts: "my_listings_past",
} as const;
