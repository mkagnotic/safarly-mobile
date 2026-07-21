import "react-native-url-polyfill/auto";

import { createClient } from "@supabase/supabase-js";

import { SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";
import type { Database } from "./types";

/**
 * A throwaway Supabase client used solely for the password-reset exchange.
 *
 * Why not the shared `supabase` client: `verifyOtp({ type: "recovery" })`
 * returns a real session. On the shared client that would persist to
 * AsyncStorage and fire `onAuthStateChange("SIGNED_IN")`, which `AuthContext`
 * mirrors into the store — so `RootNavigator` would swap out the pre-auth
 * stack and unmount the reset screen while its own request is still in
 * flight. Web doesn't hit this because its reset page is a separate page load.
 *
 * With `persistSession: false` the recovery session lives only in this
 * client's memory: nothing is written to storage, no auth event reaches the
 * app, and the user stays on the reset screen until they're done. The session
 * is still good enough to authorise `updateUser`, which is all we need.
 *
 * Deliberately created per call rather than kept as a module singleton, so no
 * recovery session outlives the screen that made it.
 */
export function createRecoveryClient() {
  return createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  });
}
