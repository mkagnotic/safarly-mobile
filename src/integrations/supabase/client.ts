import "react-native-url-polyfill/auto";

import { AppState, Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { resilientAuthFetch } from "./authFetch";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

// `detectSessionInUrl` is platform-gated: native uses an in-app token flow
// (no URL hash to parse), web uses Supabase's browser redirect which returns
// tokens in the URL fragment. `react-native-url-polyfill/auto` is required
// because supabase-js builds request URLs via the `URL` constructor, which
// is incomplete in Hermes.
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === "web",
  },
  // A 5xx while refreshing the token must not sign the user out — see authFetch.ts.
  global: { fetch: resilientAuthFetch },
});

/** Where supabase-js persists the session (its default key for this project). */
export const SUPABASE_AUTH_STORAGE_KEY = `sb-${new URL(SUPABASE_URL).hostname.split(".")[0]}-auth-token`;

/**
 * Whether a session is still persisted on this device. supabase-js deletes it
 * only on a definitive rejection (or an explicit sign-out), so a stored session
 * with no usable token in hand means "couldn't refresh right now", not "signed
 * out".
 */
export async function hasStoredSession(): Promise<boolean> {
  try {
    return (await AsyncStorage.getItem(SUPABASE_AUTH_STORAGE_KEY)) != null;
  } catch {
    return false;
  }
}

// Supabase's documented React Native setup. A browser tells supabase-js when
// the page is hidden or shown; a native app doesn't, so the refresh timer kept
// "running" through a suspended JS thread and the app resumed on a token that
// had expired while it was in the background. Pause refreshing in the
// background and resume (which refreshes immediately if needed) on return.
if (Platform.OS !== "web") {
  AppState.addEventListener("change", (state) => {
    if (state === "active") {
      void supabase.auth.startAutoRefresh();
    } else {
      void supabase.auth.stopAutoRefresh();
    }
  });
}
