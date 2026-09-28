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

export interface AccountDeletionStatus {
  method: "password" | "email_code";
  email: string | null;
  apple_linked: boolean;
  blocked: boolean;
  blocked_reason: string | null;
}

export interface AccountDeletionConfirmation {
  password?: string;
  code?: string;
  /** Fresh Sign in with Apple authorization code, so the server can revoke Apple's tokens. */
  apple_authorization_code?: string;
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

  /**
   * Whether this account can be deleted right now, and how the owner confirms
   * it: `password` for accounts that have one, `email_code` for accounts created
   * through Google or Apple. `blocked_reason` is user-facing copy.
   */
  getAccountDeletionStatus: () => api.get<AccountDeletionStatus>("/user-handler/me/deletion"),

  /** Emails a 6-digit confirmation code. Only for `email_code` accounts. */
  sendAccountDeletionCode: () =>
    api.post<{ sent: boolean; expires_in_minutes: number }>("/user-handler/me/deletion/code", {}),

  /**
   * Permanently deletes the signed-in account after confirming the password or
   * emailed code. The server revokes every session and push token, anonymizes
   * the profile, and removes the sign-in identity; wrong confirmation fails with
   * REAUTH_FAILED, an in-progress delivery or wallet balance with CONFLICT.
   *
   * The access token is void once this succeeds — sign out locally straight after.
   */
  deleteMyAccount: (confirmation: AccountDeletionConfirmation) =>
    api.post<{ deleted: boolean }>("/user-handler/me/delete", confirmation),
};
