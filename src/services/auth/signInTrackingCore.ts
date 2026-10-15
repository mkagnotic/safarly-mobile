// Pure (no imports at all) so it runs under `node --test`. The keystore and the
// API call are passed in: the app wires expo-secure-store and authApi.

/**
 * Sign-in security signals, the app's half of web's `captureSignIn`
 * (AuthContext.tsx). The server's POST /auth-handler/track records the hashed
 * IP, the country and this device id in `auth_events`, which the admin user
 * page's "Device & Network" card counts. Until this existed the apps never
 * called it, so every app-only account showed 0 devices and 0 IPs.
 *
 * Observe-only: nothing here can block or slow a sign-in.
 */

/** The slice of expo-secure-store this needs. */
export interface KeyStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
}

export const DEVICE_ID_KEY = "safarly.deviceId.v1";
const DEVICE_ID = /^app-[0-9a-f]{32}$/;

/** 128 random bits. It only has to be unique per install, not secret. */
export function newDeviceId(random: () => number = Math.random): string {
  let hex = "";
  for (let i = 0; i < 32; i++) hex += Math.floor(random() * 16).toString(16);
  return `app-${hex}`;
}

/**
 * One id per install, kept in the keystore. Never throws: if the keystore is
 * unavailable the id lives for this launch only, and the server still records
 * the IP.
 */
export function createDeviceIdGetter(store: KeyStore, make: () => string = () => newDeviceId()) {
  let cached: Promise<string> | null = null;
  return (): Promise<string> => {
    cached ??= (async () => {
      try {
        const saved = await store.getItemAsync(DEVICE_ID_KEY);
        if (saved && DEVICE_ID.test(saved)) return saved;
      } catch {
        /* unreadable keystore: fall through to a fresh id */
      }
      const id = make();
      try {
        await store.setItemAsync(DEVICE_ID_KEY, id);
      } catch {
        /* keep it for this launch */
      }
      return id;
    })();
    return cached;
  };
}

/** A sign-in this soon after the account was created is its sign-up. */
export const SIGNUP_WINDOW_MS = 10 * 60 * 1000;

export interface SignInTrackerDeps {
  getDeviceId: () => Promise<string>;
  send: (deviceFp: string | null, eventType: "login" | "signup") => Promise<unknown>;
  now?: () => number;
}

/**
 * Records each signed-in user once per app launch: a fresh sign-in, and a
 * session restored at launch (the common case for app users, who rarely sign
 * in again). Mirrors web, which records once per tab. Failures are swallowed.
 */
export function createSignInTracker({ getDeviceId, send, now = Date.now }: SignInTrackerDeps) {
  const done = new Set<string>();
  return async (userId: string, createdAt?: string | null): Promise<void> => {
    if (!userId || done.has(userId)) return;
    done.add(userId);
    const created = createdAt ? Date.parse(createdAt) : NaN;
    const eventType = Number.isFinite(created) && now() - created < SIGNUP_WINDOW_MS ? "signup" : "login";
    try {
      const fp = await getDeviceId().catch(() => null);
      await send(fp, eventType);
    } catch {
      // Let a later launch try again; never surface this to the user.
      done.delete(userId);
    }
  };
}
