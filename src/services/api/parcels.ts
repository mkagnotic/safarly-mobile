import { api } from "./client";

/**
 * Server response shape — broader than the canonical `Parcel` because the
 * parcel-handler edge function returns `weight` (not `weight_kg`) and may
 * omit `fee_currency` entirely. We normalize before handing data to screens
 * so consumers can rely on the typed `Parcel` shape.
 */
interface RawParcel {
  weight?: number;
  weight_kg?: number;
  fee_currency?: string;
  /**
   * Server's `parcel-handler` joins the sender via
   * `user_profiles!parcel_requests_sender_id_fkey`, which lands the joined
   * object under the column key `user_profiles` — NOT the canonical `sender`
   * name screens read. Web has the same latent bug; mobile aliases here.
   */
  user_profiles?: Parcel["sender"];
  sender?: Parcel["sender"];
  [key: string]: unknown;
}

const DEFAULT_FEE_CURRENCY = "USD";

function normalizeParcel(raw: RawParcel): Parcel {
  return {
    ...raw,
    weight_kg: typeof raw.weight_kg === "number" ? raw.weight_kg : Number(raw.weight ?? 0),
    fee_currency: raw.fee_currency ?? DEFAULT_FEE_CURRENCY,
    sender: raw.sender ?? raw.user_profiles ?? undefined,
  } as unknown as Parcel;
}

export interface Parcel {
  id: string;
  sender_id: string;
  from_city: string;
  from_country: string;
  to_city: string;
  to_country: string;
  any_from: boolean;
  any_to: boolean;
  category: string;
  weight_kg: number;
  description: string | null;
  delivery_by: string;
  /** Delivery window start/end. Present when the sender picked a date range. */
  delivery_by_from?: string | null;
  delivery_by_to?: string | null;
  fee_offered: number;
  fee_currency: string;
  status: string;
  image_urls: string[];
  created_at: string;
  updated_at: string;
  sender?: { id: string; name: string; avatar_url: string | null; rating: number };
}

/** A carrier trip that can deliver a parcel — from `/parcel-handler/matches`. */
export interface ParcelCarrierMatch {
  trip_id: string;
  carrier_id: string;
  carrier_name: string;
  from_city: string;
  to_city: string;
  travel_date: string;
  luggage_capacity?: number;
  luggage_capacity_kg?: number;
  airline: string | null;
  open_to_buddy?: boolean;
  match_score?: number;
  carrier?: { id: string; name: string; avatar_url: string | null; rating: number } | null;
}

export interface ParcelListParams {
  filter?: string;
  status?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export const parcelsApi = {
  create: (data: {
    from_city: string;
    from_country?: string;
    to_city: string;
    to_country?: string;
    category: string;
    weight_kg: number;
    description?: string;
    delivery_by: string;
    delivery_by_from?: string;
    delivery_by_to?: string;
    fee_offered: number;
    fee_currency?: string;
    any_from?: boolean;
    any_to?: boolean;
  }) => {
    const { weight_kg, ...rest } = data;
    return api.post<Parcel>("/parcel-handler/", { ...rest, weight: weight_kg });
  },

  list: async (params?: ParcelListParams) => {
    const res = await api.get<Parcel[]>("/parcel-handler/", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((p) => normalizeParcel(p as unknown as RawParcel));
    }
    return res;
  },

  getById: async (id: string) => {
    const res = await api.get<Parcel>(`/parcel-handler/${id}`);
    if (res.data) res.data = normalizeParcel(res.data as unknown as RawParcel);
    return res;
  },

  update: (
    id: string,
    data: {
      from_city?: string;
      from_country?: string;
      to_city?: string;
      to_country?: string;
      category?: string;
      description?: string;
      weight_kg?: number;
      fee_offered?: number;
      delivery_by?: string;
      delivery_by_from?: string;
      delivery_by_to?: string;
      any_from?: boolean;
      any_to?: boolean;
      status?: string;
    },
  ) => {
    const { weight_kg, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (weight_kg !== undefined) payload.weight = weight_kg;
    return api.put<Parcel>(`/parcel-handler/${id}`, payload);
  },

  delete: (id: string) => api.delete<{ deleted: boolean }>(`/parcel-handler/${id}`),

  /** DB matching function (route + ANY origin/destination support). */
  findMatches: (parcel_id: string) =>
    api.get<ParcelCarrierMatch[]>("/parcel-handler/matches", { parcel_id }),

  findOpportunities: async (params?: { page?: number; per_page?: number }) => {
    const res = await api.get<Parcel[]>("/parcel-handler/opportunities", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((p) => normalizeParcel(p as unknown as RawParcel));
    }
    return res;
  },

  // --- Admin endpoints ---
  adminList: (params?: { page?: number; per_page?: number }) =>
    api.get<Parcel[]>("/parcel-handler/admin", params),

  adminFlag: (id: string, reason: string) =>
    api.put<{ flagged: boolean }>(`/parcel-handler/admin/${id}/flag`, { reason }),

  adminRemove: (id: string) => api.delete<{ removed: boolean }>(`/parcel-handler/admin/${id}`),

  adminMarkDelivered: (id: string) =>
    api.put<{ status: string }>(`/parcel-handler/admin/${id}/mark-delivered`),
};
