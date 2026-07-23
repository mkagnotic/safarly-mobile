import { api } from "./client";

export interface SearchFilters {
  from_city?: string;
  to_city?: string;
  date_from?: string;
  date_to?: string;
  /** comma-separated: travel_buddy,carrier,receive_request */
  looking_for?: string;
  match_my_routes?: boolean;
  page?: number;
  per_page?: number;
  /** Independent per-list pages; each falls back to `page` server-side. */
  carrier_page?: number;
  receive_page?: number;
  buddy_page?: number;
}

/** Daily search budget, enforced server-side per account (shared web + mobile). */
export interface SearchQuota {
  limit: number;
  used: number;
  remaining: number;
}

export interface PackageMatch {
  type: "carrier_trip" | "receive_request";
  id: string;
  from_city: string;
  from_country?: string;
  to_city: string;
  to_country?: string;
  any_from?: boolean;
  any_to?: boolean;
  travel_date?: string;
  delivery_by?: string;
  luggage_capacity_kg?: number;
  airline?: string;
  open_to_buddy?: boolean;
  weight_kg?: number;
  category?: string;
  fee_offered?: number;
  description?: string;
  /**
   * Client-set (not from the server): in auto-match, flagged true when the
   * parcel's weight exceeds the carrier's luggage capacity. Web parity — a
   * match still shows but wears a warning pill.
   */
  exceeds_capacity?: boolean;
  carrier?: { id: string; name: string; avatar_url: string | null; rating: number } | null;
  sender?: { id: string; name: string; avatar_url: string | null; rating: number } | null;
}

export interface BuddySearchMatch {
  type: "travel_buddy";
  id: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_date_from?: string;
  travel_date_to?: string;
  airline?: string;
  bio?: string;
  age?: number;
  languages?: string[];
  interests?: string;
  layover?: string;
  user: { id: string; name: string; avatar_url: string | null; rating: number } | null;
}

export interface SearchResults {
  package_matches: PackageMatch[];
  buddy_matches: BuddySearchMatch[];
  /** Pre-pagination totals — drive per-tab page counts. */
  package_total?: number;
  carrier_total?: number;
  receive_total?: number;
  buddy_total?: number;
  /** Present when `match_my_routes` is set. */
  my_trips_count?: number;
  my_parcels_count?: number;
  my_buddy_listings_count?: number;
  my_buddy_route_targets_count?: number;
  /** Fresh quota snapshot returned with every search response. */
  search_quota?: SearchQuota;
}

export interface SearchMeta {
  page: number;
  per_page: number;
  package_total: number;
  buddy_total: number;
}

export const searchApi = {
  search: (filters: SearchFilters) => api.get<SearchResults>("/search-handler/", filters),

  /** Consumes one daily unit. Throws `ApiClientError` (429 `RATE_LIMITED`) at the cap. */
  consumeSearchQuota: () => api.post<SearchQuota>("/search-handler/usage"),
};
