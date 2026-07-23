import { api } from "./client";

export interface UserProfile {
  id: string;
  name: string;
  bio: string | null;
  city: string | null;
  country: string | null;
  role: string;
  avatar_url: string | null;
  rating: number;
  on_time_rate: number;
  response_rate: number;
  total_deliveries: number;
  total_trips: number;
  kyc_status: string;
  terms_accepted_at: string | null;
  created_at: string;
}

export interface UserPreferences {
  language: string;
  theme: string;
  currency: string;
  email_notifications: boolean;
  /**
   * Server-authoritative push opt-in. MUST stay named `push_enabled` — the
   * `user-handler` PUT whitelist and `_shared/push.ts` both key off exactly this
   * field. The old mobile name `push_notifications` was silently dropped by the
   * whitelist, so the toggle never persisted. (SMS was removed entirely.)
   */
  push_enabled: boolean;
}

export interface UserStats {
  rating: number;
  total_trips: number;
  total_deliveries: number;
  on_time_rate: number;
  response_rate: number;
}

export const usersApi = {
  getMyProfile: () =>
    api.get<{ profile: UserProfile; preferences: UserPreferences }>("/user-handler/me"),

  updateMyProfile: (data: {
    name?: string;
    bio?: string;
    city?: string;
    country?: string;
    avatar_url?: string;
  }) => api.put<UserProfile>("/user-handler/me", data),

  getPublicProfile: (id: string) => api.get<UserProfile>(`/user-handler/${id}`),

  getUserStats: (id: string) => api.get<UserStats>(`/user-handler/${id}/stats`),

  getMyPreferences: () => api.get<UserPreferences>("/user-handler/me/preferences"),

  updateMyPreferences: (data: Partial<UserPreferences>) =>
    api.put<UserPreferences>("/user-handler/me/preferences", data),

  registerPushToken: (token: string, platform: "ios" | "android" | "web") =>
    api.post<{ registered: boolean }>("/user-handler/me/push-token", { token, platform }),

  removePushToken: (token: string) =>
    api.delete<{ removed: boolean }>(
      `/user-handler/me/push-token?token=${encodeURIComponent(token)}`,
    ),
};
