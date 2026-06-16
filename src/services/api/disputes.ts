import { api, newIdempotencyKey } from "./client";

export interface Dispute {
  id: string;
  booking_id: string;
  filed_by: string;
  category: string;
  description: string;
  status: string;
  resolution: string | null;
  evidence_files: { url: string; name: string }[];
  created_at: string;
  updated_at: string;
  booking?: { id: string; parcel_id: string; sender_id: string; carrier_id: string };
  filer?: { id: string; name: string; avatar_url: string | null };
  messages?: { id: string; sender_id: string; text: string; created_at: string }[];
}

export const disputesApi = {
  create: (data: { booking_id: string; category: string; description: string }) =>
    api.post<Dispute>("/dispute-handler/", data),

  getMyDisputes: (params?: { page?: number; per_page?: number }) =>
    api.get<Dispute[]>("/dispute-handler/me", params),

  getById: (id: string) => api.get<Dispute>(`/dispute-handler/${id}`),

  uploadEvidence: (id: string, formData: FormData) =>
    api.upload<{ evidence_files: string[] }>(`/dispute-handler/${id}/evidence`, formData),

  addMessage: (id: string, text: string) =>
    api.post<{ message: unknown }>(`/dispute-handler/${id}/messages`, { text }),

  /**
   * Sender waives the CASH penalty after a return-eligible post-possession
   * cancel — the carrier is refunded the penalty but the strike remains.
   */
  confirmReturnWaiver: (disputeId: string, idempotencyKey = newIdempotencyKey()) =>
    api.post<{
      waived: boolean;
      refunded_amount: number;
      booking_status: string;
      strike_remains: boolean;
    }>(`/dispute-handler/${disputeId}/confirm-return-waiver`, {}, { idempotencyKey }),

  // --- Admin endpoints ---
  adminList: (params?: { page?: number; per_page?: number }) =>
    api.get<Dispute[]>("/dispute-handler/admin", params),

  adminGetById: (id: string) => api.get<Dispute>(`/dispute-handler/admin/${id}`),

  adminResolve: (id: string, resolution: string) =>
    api.put<{ status: string }>(`/dispute-handler/admin/${id}/resolve`, { resolution }),

  adminEscalate: (id: string) =>
    api.put<{ status: string }>(`/dispute-handler/admin/${id}/escalate`),
};
