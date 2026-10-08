import { Platform } from "react-native";

import { SUPABASE_ANON_KEY, SUPABASE_FUNCTIONS_URL } from "@/integrations/supabase/env";

/**
 * Public client config, fetched at boot to decide whether this build is still
 * allowed to run.
 *
 * Deliberately NOT routed through `services/api/client.ts`. That client attaches
 * a session, retries a 401 by refreshing, and surfaces user-facing errors —
 * all correct for app requests, all wrong here. This call happens BEFORE auth,
 * must never prompt anything, and must never make a user wait: it is a plain
 * fetch with its own short deadline.
 */

export interface PlatformGate {
  minimumVersion?: string;
  message?: string;
  storeUrl?: string;
}

/**
 * How long the app will wait at boot before giving up and letting the user in.
 *
 * Short on purpose. This runs in front of the first screen, so every
 * millisecond is felt. A slow answer is treated exactly like no answer: the
 * app opens. The gate exists to stop a known-broken build, not to make a
 * healthy one hostage to a cold edge function.
 */
const TIMEOUT_MS = 3_000;

/**
 * Returns the gate for this platform, or null when it cannot be determined.
 *
 * NEVER throws and NEVER rejects. Callers treat null as "no gate", so a network
 * failure, a timeout, a 500 or a malformed body all land on the same safe
 * answer: let the user in.
 */
export async function fetchPlatformGate(): Promise<PlatformGate | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(`${SUPABASE_FUNCTIONS_URL}/app-config`, {
      method: "GET",
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
      signal: controller.signal,
    });
    if (!res.ok) return null;

    const body = (await res.json()) as { data?: { mobile?: Record<string, PlatformGate> } };
    const mobile = body?.data?.mobile;
    if (!mobile || typeof mobile !== "object") return null;

    const gate = Platform.OS === "ios" ? mobile.ios : mobile.android;
    return gate && typeof gate === "object" ? gate : null;
  } catch {
    // Offline, aborted, DNS failure, bad JSON — all the same answer. See above.
    return null;
  } finally {
    clearTimeout(timer);
  }
}
