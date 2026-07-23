import { api } from "./client";
import type { RNUploadFile } from "./messages";

/**
 * Travel-document verification state for a carrier_request (the pre-booking
 * deal). Ported verbatim from web (`web/src/services/api/carriers.ts`) so the
 * two platforms read the SAME server shape. Approval is what unlocks payment
 * (backend-enforced).
 */
export interface TravelDocState {
  carrier_request_id: string;
  parcel_id: string;
  status: "none" | "pending" | "approved" | "rejected";
  attempts: number;
  max_attempts: number;
  rejection_reason: string | null;
  escalated: boolean;
  doc_url: string | null;
  carrier_id: string;
  sender_id: string | null;
  viewer_role: "carrier" | "sender";
}

export interface CarrierRequest {
  id: string;
  parcel_id: string;
  trip_id: string;
  carrier_id: string;
  offer_amount: number;
  message: string | null;
  status: string;
  created_at: string;
  carrier?: {
    id: string;
    name: string;
    avatar_url: string | null;
    rating: number;
    delivery_count?: number;
  };
  parcel?: { id: string; from_city: string; to_city: string; category: string };
  trip?: { id: string; from_city: string; to_city: string; travel_date: string };
}

export const carriersApi = {
  submitBid: (
    parcel_id: string,
    data: { trip_id: string; offer_amount: number; message?: string },
  ) => api.post<CarrierRequest>(`/carrier-request-handler/${parcel_id}/requests`, data),

  getBids: (parcel_id: string) =>
    api.get<CarrierRequest[]>(`/carrier-request-handler/${parcel_id}/requests`),

  acceptBid: (parcel_id: string, request_id: string) =>
    api.put<{ booking: unknown; payment_required: boolean }>(
      `/carrier-request-handler/${parcel_id}/requests/${request_id}/accept`,
    ),

  rejectBid: (parcel_id: string, request_id: string) =>
    api.put<{ status: string }>(
      `/carrier-request-handler/${parcel_id}/requests/${request_id}/reject`,
    ),

  withdrawBid: (parcel_id: string, request_id: string) =>
    api.put<{ status: string }>(
      `/carrier-request-handler/${parcel_id}/requests/${request_id}/withdraw`,
    ),

  getMyBids: (params?: { page?: number; per_page?: number }) =>
    api.get<CarrierRequest[]>("/carrier-request-handler/me", params),

  // --- Travel-document verification (carrier proves their flight before payment) ---

  /** Verification state for a deal (either participant). */
  getTravelDoc: (requestId: string) =>
    api.get<TravelDocState>(`/carrier-request-handler/travel-doc/${requestId}`),

  /**
   * Carrier uploads a boarding pass / flight ticket. Accepts an RN file blob
   * (`{ uri, name, type }`) — image (jpeg/png/webp) or PDF. The server enforces
   * the type + 3-attempt limit.
   *
   * Uses `api.uploadRNFile` (reads the bytes + hand-builds the body), NOT
   * `api.upload`: a plain `FormData` file part built from a picker `uri` reaches
   * the edge function empty under Expo/Hermes and 422s. See `client.ts`.
   */
  uploadTravelDoc: (requestId: string, file: RNUploadFile) =>
    api.uploadRNFile<{ status: string; attempts: number; path: string; url: string }>(
      `/carrier-request-handler/travel-doc/${requestId}/upload`,
      file,
    ),

  /** Sender approves the uploaded document (unlocks payment). */
  approveTravelDoc: (requestId: string) =>
    api.post<{ status: string }>(
      `/carrier-request-handler/travel-doc/${requestId}/approve`,
      {},
    ),

  /** Sender requests a re-upload with a reason. */
  rejectTravelDoc: (requestId: string, reason: string) =>
    api.post<{ status: string; attempts_left: number }>(
      `/carrier-request-handler/travel-doc/${requestId}/reject`,
      { reason },
    ),

  /** Carrier escalates to admin after exhausting upload attempts. */
  requestTravelDocAdminReview: (requestId: string) =>
    api.post<{ escalated: boolean }>(
      `/carrier-request-handler/travel-doc/${requestId}/request-admin-review`,
      {},
    ),
};
