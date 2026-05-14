import { api } from "./client";

export interface AdminStats {
  total_users: number;
  total_parcels: number;
  total_trips: number;
  total_bookings: number;
  open_disputes: number;
  pending_kyc: number;
  total_revenue: number;
  active_users: number;
  total_requests: number;
  requests_matched: number;
  pending_requests: number;
  completed_deliveries: number;
  match_success_rate: number;
  match_failure_rate: number;
}

export interface HealthCheckResponse {
  status: string;
  timestamp: string;
  version: string;
  services: { database: string; stripe: string; storage: string };
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  role: string;
  kyc_status: string;
  is_suspended: boolean;
  suspension_reason: string | null;
  city: string | null;
  country: string | null;
  bio: string | null;
  avatar_url: string | null;
  rating: number;
  total_trips: number;
  total_deliveries: number;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  admin_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export type AdminSettings = Record<string, unknown>;

export const adminApi = {
  getStats: () => api.get<AdminStats>("/admin-handler/stats"),

  listUsers: (params?: {
    search?: string;
    status?: string;
    page?: number;
    per_page?: number;
  }) => api.get<AdminUser[]>("/admin-handler/users", params),

  getUserById: (id: string) => api.get<AdminUser>(`/admin-handler/users/${id}`),

  suspendUser: (id: string, reason: string) =>
    api.put<{ suspended: boolean }>(`/admin-handler/users/${id}/suspend`, { reason }),

  reinstateUser: (id: string) =>
    api.put<{ reinstated: boolean }>(`/admin-handler/users/${id}/reinstate`),

  flagUser: (id: string, reason: string) =>
    api.put<{ flagged: boolean }>(`/admin-handler/users/${id}/flag`, { reason }),

  getSettings: () => api.get<AdminSettings>("/admin-handler/settings"),

  updateSettings: (data: Record<string, unknown>) =>
    api.put<{ updated: boolean }>("/admin-handler/settings", data),

  getAuditLog: (params?: { page?: number; per_page?: number }) =>
    api.get<AuditLogEntry[]>("/admin-handler/audit-log", params),

  search: (q: string) =>
    api.get<{ users: AdminUser[]; parcels: unknown[]; trips: unknown[] }>(
      "/admin-handler/search",
      { q },
    ),

  getAnalytics: (days?: number) =>
    api.get<{
      revenue_chart: { date: string; revenue: number }[];
      parcels_by_status: Record<string, number>;
      top_routes: { from: string; to: string; count: number }[];
      user_growth: { date: string; count: number }[];
    }>("/admin-handler/analytics", { days: days ?? 30 }),

  getHealthCheck: () => api.get<HealthCheckResponse>("/health-check"),
};
