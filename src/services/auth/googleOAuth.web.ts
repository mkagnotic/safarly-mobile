// Web Google sign-in via Supabase's browser-redirect OAuth — the same flow
// the production web app uses. Metro resolves this file for the web bundle
// in place of `googleOAuth.ts`, so the native package is never imported here.

import { supabase } from "@/integrations/supabase/client";

import { mapOAuthError } from "./oauthErrors";

export { AuthCancelledError } from "./oauthErrors";

/** Web always offers Google — the redirect flow needs no per-platform client. */
export function isGoogleSignInConfigured(): boolean {
  return true;
}

/**
 * The browser navigates away to Google on success, so this promise typically
 * doesn't resolve in-page — the session is established after the redirect
 * back, via `detectSessionInUrl` → `onAuthStateChange` (which `AuthProvider`
 * already listens to). Only throws if Supabase rejects before the redirect.
 */
export async function performGoogleOAuth(): Promise<void> {
  const redirectTo =
    typeof window !== "undefined" && window.location
      ? window.location.origin
      : undefined;

  const { error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo,
      queryParams: { prompt: "select_account" },
    },
  });

  if (error) {
    throw new Error(mapOAuthError(error.message, null));
  }
}

/**
 * No-op on web. There is no cached native session to clear, and the redirect
 * flow above already asks which account to use on every sign-in.
 */
export async function clearGoogleSession(): Promise<void> {}
