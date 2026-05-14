import { api } from "./client";

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
  pickup_at: string | null;
  delivered_at: string | null;
  cancelled_at: string | null;
  cancellation_reason: string | null;
  delivery_proof_url: string | null;
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

  cancel: (id: string, reason: string) =>
    api.put<{ status: string }>(`/booking-handler/${id}/cancel`, { reason }),

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
