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

/** A stored parcel-review photo/attachment with a fresh signed URL. */
export interface ParcelReviewPhoto {
  path: string;
  name: string | null;
  url: string | null;
}

/** Reject-reason slugs the carrier can choose from (web parity). */
export type ParcelReviewReason =
  | "too_large"
  | "restricted"
  | "fragile"
  | "different_than_described"
  | "airline_restriction"
  | "other";

/** Parcel-review state for a carrier_request (mirror of TravelDocState, roles swapped). */
export interface ParcelReviewState {
  carrier_request_id: string;
  parcel_id: string;
  status: "none" | "pending" | "approved" | "rejected";
  photos: ParcelReviewPhoto[];
  reason: ParcelReviewReason | null;
  reason_note: string | null;
  min_photos: number;
  max_photos: number;
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

  // --- Parcel review (sender uploads parcel photos, carrier approves before payment) ---

  /** Parcel-review state for a deal (either participant). */
  getParcelReview: (requestId: string) =>
    api.get<ParcelReviewState>(`/carrier-request-handler/parcel-review/${requestId}`),

  /**
   * Sender uploads parcel photos (min 2, image or PDF). Uses the RN-safe
   * multi-file uploader (field name `files`) — a plain FormData part reaches the
   * edge function empty under Expo/Hermes. See `client.ts`.
   */
  uploadParcelReview: (requestId: string, files: RNUploadFile[]) =>
    api.uploadRNFiles<{ status: string; photos: ParcelReviewPhoto[] }>(
      `/carrier-request-handler/parcel-review/${requestId}/upload`,
      files,
      "files",
    ),

  /** Carrier approves the parcel. */
  approveParcelReview: (requestId: string) =>
    api.post<{ status: string }>(
      `/carrier-request-handler/parcel-review/${requestId}/approve`,
      {},
    ),

  /** Carrier requests changes with a reason (and optional note). */
  rejectParcelReview: (requestId: string, reason: ParcelReviewReason, note?: string) =>
    api.post<{ status: string; reason: string }>(
      `/carrier-request-handler/parcel-review/${requestId}/reject`,
      { reason, note },
    ),
};
