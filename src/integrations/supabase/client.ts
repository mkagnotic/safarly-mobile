import "react-native-url-polyfill/auto";

import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

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
});
