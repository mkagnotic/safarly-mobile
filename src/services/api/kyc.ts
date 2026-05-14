import { api } from "./client";

export interface KycSubmission {
  id: string;
  user_id: string;
  doc_type: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  rejection_reason: string | null;
  documents: { type: string; url: string }[];
  user?: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    country: string | null;
  };
}

export const kycApi = {
  initiate: (doc_type: string) =>
    api.post<{ session_id: string; verification_url: string }>("/kyc-handler/initiate", {
      doc_type,
    }),

  getStatus: () =>
    api.get<{ status: string; submission: KycSubmission | null }>("/kyc-handler/status"),

  // --- Admin endpoints ---
  adminList: (params?: { page?: number; per_page?: number }) =>
    api.get<KycSubmission[]>("/kyc-handler/admin", params),

  adminGetById: (id: string) => api.get<KycSubmission>(`/kyc-handler/admin/${id}`),

  adminApprove: (id: string) =>
    api.put<{ status: string }>(`/kyc-handler/admin/${id}/approve`),

  adminReject: (id: string, reason: string) =>
    api.put<{ status: string }>(`/kyc-handler/admin/${id}/reject`, { reason }),

  adminRequestResubmission: (id: string, reason: string) =>
    api.put<{ status: string }>(`/kyc-handler/admin/${id}/request-resubmission`, { reason }),
};
