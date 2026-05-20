import { supabase } from "@/integrations/supabase/client";

import { api } from "./client";

export interface AuthUser {
  id: string;
  email: string;
  phone: string | null;
  role: string;
  name: string;
  avatar_url: string | null;
  kyc_status: string;
  is_suspended: boolean;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export const authApi = {
  /** Admin login via edge function. */
  adminLogin: (email: string, password: string) =>
    api.post<{ user: AuthUser; session: AuthSession }>("/auth-handler/admin/login", {
      email,
      password,
    }),

  /** Phone OTP — send code. */
  sendPhoneOtp: (phone: string) =>
    api.post<{ message_id: string; expires_in: number }>("/auth-handler/phone/send-otp", {
      phone,
    }),

  /** Phone OTP — verify code. */
  verifyPhoneOtp: (phone: string, otp: string) =>
    api.post<{ user: AuthUser; session: AuthSession; is_new_user: boolean }>(
      "/auth-handler/phone/verify-otp",
      { phone, otp },
    ),

  /** Customer login via Supabase Auth (email/password). */
  customerLogin: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    return data;
  },

  /** Customer signup via Supabase Auth. */
  customerSignup: async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
    return data;
  },

  /**
   * Google OAuth via Supabase Auth — the mobile twin of the web app's
   * `authApi.googleLogin`. The web app does a browser redirect; native uses
   * the OS Google account picker, which yields a signed ID token that
   * Supabase verifies here. The Google client ID/secret still live only in
   * the Supabase Dashboard, so the same Google credentials back both clients.
   */
  googleSignInWithIdToken: async (idToken: string) => {
    const { data, error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    });
    if (error) throw error;
    return data;
  },

  /** Get current user. */
  me: () => api.get<AuthUser>("/auth-handler/me"),

  /** Refresh token. */
  refreshToken: (refresh_token: string) =>
    api.post<AuthSession>("/auth-handler/refresh", { refresh_token }),

  /** Logout — clears the local session, then notifies the server. */
  logout: async () => {
    await supabase.auth.signOut();
    return api.post("/auth-handler/logout");
  },

  /** Forgot password. */
  forgotPassword: (email: string) =>
    api.post<{ message: string }>("/auth-handler/forgot-password", { email }),

  /** Reset password. */
  resetPassword: (token: string, new_password: string) =>
    api.post<{ message: string }>("/auth-handler/reset-password", { token, new_password }),

  /** Change password. */
  changePassword: (current_password: string, new_password: string) =>
    api.put<{ message: string }>("/auth-handler/change-password", {
      current_password,
      new_password,
    }),

  /** Change email. */
  changeEmail: (new_email: string, password: string) =>
    api.put<{ message: string }>("/auth-handler/change-email", { new_email, password }),

  /** Accept terms. */
  acceptTerms: (terms_version: string) =>
    api.post<{ accepted: boolean }>("/auth-handler/accept-terms", { terms_version }),
};
