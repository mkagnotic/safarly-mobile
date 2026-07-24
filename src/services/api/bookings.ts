import { api, newIdempotencyKey } from "./client";
import type { RNUploadFile } from "./messages";

/**
 * Server response shapes — booking-handler returns Postgres-join-typed keys
 * (`parcel_requests`, `user_profiles`, `booking_timeline`). Mobile screens
 * read the canonical names below (`parcel`, `sender`, `carrier`, `timeline`).
 * Normalize once here so consumers can rely on the typed `Booking` shape.
 */
interface RawBooking {
  parcel?: Booking["parcel"];
  parcel_requests?: Booking["parcel"];
  sender?: Booking["sender"];
  carrier?: Booking["carrier"];
  /** On list: server returns sender as `user_profiles` (no carrier joined). */
  user_profiles?: Booking["sender"];
  timeline?: Booking["timeline"];
  booking_timeline?: Booking["timeline"];
  [key: string]: unknown;
}

function normalizeBooking(raw: RawBooking): Booking {
  const parcel = raw.parcel ?? raw.parcel_requests ?? undefined;
  const sender = raw.sender ?? raw.user_profiles ?? undefined;
  const carrier = raw.carrier ?? undefined;
  const timeline = raw.timeline ?? raw.booking_timeline ?? undefined;
  return {
    ...raw,
    parcel,
    sender,
    carrier,
    timeline,
  } as unknown as Booking;
}

export interface Booking {
  id: string;
  parcel_id: string;
  carrier_request_id: string;
  sender_id: string;
  carrier_id: string;
  status: string;
  /** ISO deadline (~72h after creation) for paying a `pending_payment` booking. */
  payment_expires_at?: string | null;
  pickup_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  delivery_proof_url: string | null;
  // ── Part 4 fulfillment fields ──
  cancellation_phase?: string | null;
  penalty_amount?: number | null;
  penalty_waived?: boolean | null;
  handoff_accepted_at?: string | null;
  handoff_rejected_at?: string | null;
  handoff_rejection_reason?: string | null;
  handoff_rejection_proof_url?: string | null;
  /**
   * Travel date the pair agreed on. Returned by `booking-handler`'s list select
   * and used by the journey tracker for the "Travel Tomorrow" / "Traveling"
   * stages. `normalizeBooking` spreads the raw row, so this already arrived at
   * runtime before it was declared here.
   */
  agreed_travel_date?: string | null;
  /**
   * Whether the CURRENT viewer has already rated this booking. Resolved
   * per-viewer by `booking-handler` from `ratings.author_id` on both the list
   * and detail endpoints. Drives the tracker's "Review" stage and the
   * Rate/Rated state on archive cards.
   */
  viewer_has_rated?: boolean;
  created_at: string;
  updated_at: string;
  parcel?: {
    id?: string;
    from_city: string;
    to_city: string;
    category: string;
    fee_offered: number;
    weight?: number;
    weight_kg?: number;
    description?: string | null;
    delivery_by?: string;
  };
  sender?: { id?: string; name: string; avatar_url: string | null; rating?: number };
  carrier?: { id?: string; name: string; avatar_url: string | null; rating?: number };
  /** Deal-level travel-document verification — drives the tracker's "Flight Verified". */
  carrier_request?: {
    travel_doc_status?: "none" | "pending" | "approved" | "rejected";
    parcel_review_status?: "none" | "pending" | "approved" | "rejected";
  } | null;
  timeline?: { event: string; description: string | null; created_at: string }[];
}

export interface BookingDetailResponse {
  booking: Booking;
  payment: { id: string; amount: number; status: string; type: string } | null;
  timeline: { event: string; description: string | null; created_at: string }[];
}

export const bookingsApi = {
  list: async (params?: { role?: string; status?: string; page?: number; per_page?: number }) => {
    const res = await api.get<Booking[]>("/booking-handler/", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((b) => normalizeBooking(b as unknown as RawBooking));
    }
    return res;
  },

  getById: async (id: string) => {
    const res = await api.get<BookingDetailResponse>(`/booking-handler/${id}`);
    if (res.data?.booking) {
      res.data.booking = normalizeBooking(res.data.booking as unknown as RawBooking);
    }
    return res;
  },

  markPickup: (id: string) => api.put<{ status: string }>(`/booking-handler/${id}/pickup`),

  /** Carrier takes possession at inspection: awaiting_handoff → in_transit. */
  acceptHandoff: (id: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<{ status: string; handoff_accepted_at: string }>(
      `/booking-handler/${id}/handoff/accept`,
      {},
      { idempotencyKey },
    ),

  /** Carrier rejects at inspection: refunds the sender, reopens the parcel, no penalty. */
  rejectHandoff: (
    id: string,
    body: { reason: string; photo_path?: string },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<{
      status: string;
      handoff_rejected_at: string;
      refunded: boolean;
      refund_amount: number;
    }>(`/booking-handler/${id}/handoff/reject`, body, { idempotencyKey }),

  /** Upload reject evidence (carrier-only, ≤10MB image); pass the returned `path` as `photo_path`. */
  uploadHandoffEvidence: async (id: string, file: RNUploadFile) => {
    // Byte-accurate multipart via api.uploadRNFile — a plain FormData `{uri}` blob
    // arrives empty at the Deno edge fn under Expo/Hermes and 422s (same fix as
    // chat attachments / travel-doc / parcel-review). See client.ts.
    const res = await api.uploadRNFile<{ path: string; url: string }>(
      `/booking-handler/${id}/handoff/upload-evidence`,
      file,
    );
    return res.data;
  },

  cancel: (id: string, reason: string) =>
    api.put<{ status: string }>(`/booking-handler/${id}/cancel`, { reason }),

  /** Carrier cancels mid-transit: full refund to sender + tiered penalty + strike. */
  cancelPostPossession: (
    id: string,
    body: {
      reason: string;
      return_answers?: {
        will_return: boolean;
        was_online_order: boolean;
        free_return_eligible: boolean;
      };
    },
    idempotencyKey = newIdempotencyKey(),
  ) =>
    api.post<{
      status: string;
      tier: string;
      penalty_amount: number;
      refund_amount: number;
      strike_id: string | null;
      dispute_id: string | null;
      waiver_eligible: boolean;
    }>(`/booking-handler/${id}/cancel-post-possession`, body, { idempotencyKey }),

  generateOtp: (id: string) =>
    api.post<{ otp_sent: boolean; expires_in: number; otp?: string }>(
      `/booking-handler/${id}/generate-otp`,
    ),

  confirmOtp: (id: string, otp: string) =>
    api.post<{ confirmed: boolean }>(`/booking-handler/${id}/confirm-otp`, { otp }),

  resendOtp: (id: string) => api.post<{ otp_sent: boolean }>(`/booking-handler/${id}/resend-otp`),

  // --- Admin endpoints ---
  adminList: async (params?: { page?: number; per_page?: number }) => {
    const res = await api.get<Booking[]>("/booking-handler/admin", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((b) => normalizeBooking(b as unknown as RawBooking));
    }
    return res;
  },

  adminVerifyDelivery: (id: string, notes?: string) =>
    api.put<{ confirmed: boolean }>(`/booking-handler/admin/${id}/verify-delivery`, { notes }),
};
