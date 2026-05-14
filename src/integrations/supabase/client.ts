import "react-native-url-polyfill/auto";

import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * React Native Supabase client.
 *
 * Differences from the web client:
 *   - `AsyncStorage` instead of `localStorage` for the auth session.
 *   - `detectSessionInUrl: false`: there is no URL bar on native to parse a
 *     post-OAuth fragment from. OAuth on RN goes through a deep link handler
 *     that calls `supabase.auth.setSession()` directly — never URL detection.
 *   - URL polyfill imported at the top: `supabase-js` builds request URLs with
 *     the `URL` constructor, which is incomplete in Hermes/RN out of the box.
 */
export const supabase = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: AsyncStorage,
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: false,
  },
});
