import { api } from "./client";

export interface BuddyListingUser {
  id: string;
  name: string;
  avatar_url: string | null;
  rating: number;
  total_trips: number;
  city?: string | null;
}

export interface BuddyListing {
  id: string;
  user_id: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_date_from?: string | null;
  travel_date_to?: string | null;
  airline: string | null;
  bio: string | null;
  status: string;
  created_at: string;
  updated_at?: string | null;
  age?: number | null;
  languages?: string[] | null;
  interests?: string | null;
  layover?: string | null;
  user?: BuddyListingUser;
  user_profiles?: BuddyListingUser | null;
}

export interface BuddyRequest {
  id: string;
  listing_id: string;
  requester_id?: string;
  sender_id?: string;
  receiver_id?: string;
  message: string | null;
  status: string;
  created_at: string;
  requester?: { id: string; name: string; avatar_url: string | null };
  /** Server joins the sender profile under this key on the list response. */
  user_profiles?: { id?: string; name: string; avatar_url: string | null } | null;
}

export interface BuddyConnection {
  id: string;
  user_a_id: string;
  user_b_id: string;
  conversation_id: string | null;
  created_at: string;
  buddy?: { id: string; name: string; avatar_url: string | null; rating: number } | null;
  from_city?: string | null;
  to_city?: string | null;
  travel_date?: string | null;
  travel_date_from?: string | null;
  travel_date_to?: string | null;
  completed?: boolean;
  i_confirmed_completion?: boolean;
  awaiting_my_completion?: boolean;
  already_rated?: boolean;
  can_rate?: boolean;
}

export interface BuddyMatch {
  listing_id: string;
  user_id: string;
  user_name: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  airline: string | null;
  bio: string | null;
  match_score: number;
}

export interface BuddyListingInput {
  from_city: string;
  to_city: string;
  travel_date: string;
  travel_date_from?: string;
  travel_date_to?: string;
  bio?: string;
  airline?: string;
  age?: number;
  languages?: string[];
  interests?: string;
  layover?: string;
}

export const buddiesApi = {
  create: (data: BuddyListingInput) => api.post<BuddyListing>("/buddy-handler/", data),

  update: (listingId: string, data: BuddyListingInput) =>
    api.put<BuddyListing>(`/buddy-handler/${listingId}`, data),

  deleteListing: (listingId: string) =>
    api.delete<{ deleted: boolean }>(`/buddy-handler/${listingId}`),

  list: (params?: { page?: number; per_page?: number; filter?: string }) =>
    api.get<BuddyListing[]>("/buddy-handler/", params),

  /** DB matching function — route + date + airline. */
  findMatches: (listingId: string) =>
    api.get<BuddyMatch[]>("/buddy-handler/find-matches", { listing_id: listingId }),

  sendRequest: (listingId: string, message?: string) =>
    api.post<{ request_id: string }>(`/buddy-handler/${listingId}/request`, { message }),

  acceptRequest: (requestId: string) =>
    api.put<{ connection_id: string }>(`/buddy-handler/requests/${requestId}/accept`),

  rejectRequest: (requestId: string) =>
    api.put<{ status: string }>(`/buddy-handler/requests/${requestId}/reject`),

  getConnections: () => api.get<BuddyConnection[]>("/buddy-handler/connections"),

  /** Two-tap completion handshake — each buddy confirms once. */
  completeConnection: (connectionId: string) =>
    api.post<{ status: "awaiting_confirmation" | "completed" }>(
      `/buddy-handler/connections/${connectionId}/complete`,
    ),

  disconnect: (connectionId: string) =>
    api.delete<{ disconnected: boolean }>(`/buddy-handler/connections/${connectionId}`),

  getMyRequests: (direction?: "sent" | "received") =>
    api.get<BuddyRequest[]>("/buddy-handler/requests", { direction }),
};
