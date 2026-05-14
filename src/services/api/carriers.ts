import { api } from "./client";

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
};
