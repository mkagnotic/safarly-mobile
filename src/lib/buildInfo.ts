import Constants from "expo-constants";

import { isVersion } from "@/lib/appVersion";

/**
 * This build's own version, from the config embedded at build time.
 *
 * Split out from `appVersion.ts` so the gate's decision logic stays
 * import-free and therefore unit-testable — `node --test` cannot strip types
 * inside node_modules, and `expo-constants` is TypeScript.
 *
 * Returns null when it cannot be determined, and every caller treats null as
 * "do not gate". A build that cannot name itself is not evidence of being old,
 * and locking it out on suspicion is unrecoverable.
 */
export function currentAppVersion(): string | null {
  const v = Constants.expoConfig?.version;
  return isVersion(v) ? v.trim() : null;
}
