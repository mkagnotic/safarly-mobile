import { api } from "./client";

/**
 * Server response shape — the list endpoint already aliases `luggage_capacity`
 * → `luggage_capacity_kg` server-side, but `GET /trip-handler/{id}` returns
 * the raw row (`luggage_capacity`). Normalize once here so consumers can rely
 * on the typed `Trip` shape.
 */
interface RawTrip {
  luggage_capacity?: number;
  luggage_capacity_kg?: number;
  [key: string]: unknown;
}

function normalizeTrip(raw: RawTrip): Trip {
  return {
    ...raw,
    luggage_capacity_kg:
      typeof raw.luggage_capacity_kg === "number"
        ? raw.luggage_capacity_kg
        : Number(raw.luggage_capacity ?? 0),
  } as unknown as Trip;
}

export interface Trip {
  id: string;
  user_id: string;
  from_city: string;
  from_country: string;
  to_city: string;
  to_country: string;
  any_from: boolean;
  any_to: boolean;
  travel_date: string;
  luggage_capacity_kg: number;
  airline: string | null;
  notes: string | null;
  offers_count: number;
  status: string;
  created_at: string;
  updated_at: string;
  open_to_buddy: boolean;
  carrier?: { id: string; name: string; avatar_url: string | null; rating: number };
}

export interface TripListParams {
  filter?: string;
  from?: string;
  to?: string;
  page?: number;
  per_page?: number;
}

export const tripsApi = {
  create: (data: {
    from_city: string;
    from_country?: string;
    to_city: string;
    to_country?: string;
    travel_date: string;
    luggage_capacity_kg: number;
    notes?: string;
    open_to_buddy?: boolean;
    any_from?: boolean;
    any_to?: boolean;
    airline?: string;
    buddy_age?: string;
    buddy_languages?: string[];
    buddy_interests?: string;
    buddy_layover?: string;
  }) => {
    const { luggage_capacity_kg, ...rest } = data;
    return api.post<Trip>("/trip-handler/", { ...rest, luggage_capacity: luggage_capacity_kg });
  },

  list: async (params?: TripListParams) => {
    const res = await api.get<Trip[]>("/trip-handler/", params);
    if (Array.isArray(res.data)) {
      res.data = res.data.map((t) => normalizeTrip(t as unknown as RawTrip));
    }
    return res;
  },

  getById: async (id: string) => {
    const res = await api.get<Trip>(`/trip-handler/${id}`);
    if (res.data) res.data = normalizeTrip(res.data as unknown as RawTrip);
    return res;
  },

  getOffers: (id: string) =>
    api.get<{ offers: unknown[]; total: number }>(`/trip-handler/${id}/offers`),

  update: (
    id: string,
    data: {
      travel_date?: string;
      luggage_capacity_kg?: number;
      notes?: string;
      any_from?: boolean;
      any_to?: boolean;
      airline?: string;
      status?: string;
    },
  ) => {
    const { luggage_capacity_kg, ...rest } = data;
    const payload: Record<string, unknown> = { ...rest };
    if (luggage_capacity_kg !== undefined) payload.luggage_capacity = luggage_capacity_kg;
    return api.put<Trip>(`/trip-handler/${id}`, payload);
  },

  delete: (id: string) => api.delete<{ deleted: boolean }>(`/trip-handler/${id}`),

  findMatches: (parcel_id: string) => api.get<Trip[]>("/trip-handler/matches", { parcel_id }),

  findParcels: (trip_id: string) =>
    api.get<unknown[]>("/trip-handler/find-parcels", { trip_id }),
};
