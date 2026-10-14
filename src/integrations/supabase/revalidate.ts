/**
 * Notice a session that was revoked on another device, when the app comes back
 * to the foreground. Mirrors web (src/services/auth/AuthContext.tsx,
 * `revalidateSession`).
 *
 * A password reset calls signOut({ scope: "global" }), which deletes every
 * server-side session. But this device's access token stays cryptographically
 * valid until it expires (up to an hour), and supabase-js only talks to the
 * server near expiry, so the app kept showing a signed-in UI for that hour.
 *
 * The rules that keep this from causing spurious logouts (all from web):
 *   - getUser() is a real round-trip; only an error there starts a check.
 *   - An error is not proof of revocation: the token may simply have expired.
 *     A successful refresh means the session is fine.
 *   - A failed refresh is not proof either (timeouts, 5xx, no network).
 *     supabase-js deletes the stored session only on a DEFINITIVE rejection,
 *     and fires SIGNED_OUT itself when it does. So while the session is still
 *     stored, the user stays signed in.
 *   - At most one check per minute, and never one at a time twice.
 */
export interface RevalidateDeps {
  hasSession(): boolean;
  getUser(): Promise<{ error: unknown }>;
  refreshSession(): Promise<{ data: { session: unknown | null }; error: unknown }>;
  hasStoredSession(): Promise<boolean>;
  /** Called only when the session is definitively gone. */
  onRevoked(): void | Promise<void>;
  now?(): number;
}

export const MIN_INTERVAL_MS = 60_000;

export function createSessionRevalidator(deps: RevalidateDeps) {
  let checking = false;
  let lastCheckedAt = -Infinity;
  const now = deps.now ?? Date.now;

  return async function revalidate(): Promise<"skipped" | "valid" | "kept" | "revoked"> {
    if (!deps.hasSession() || checking) return "skipped";
    const t = now();
    if (t - lastCheckedAt < MIN_INTERVAL_MS) return "skipped";
    lastCheckedAt = t;
    checking = true;
    try {
      const { error } = await deps.getUser();
      if (!error) return "valid";
      const { data, error: refreshError } = await deps.refreshSession();
      if (!refreshError && data.session) return "valid";
      if (await deps.hasStoredSession()) return "kept";
      if (!deps.hasSession()) return "revoked"; // SIGNED_OUT already handled it
      await deps.onRevoked();
      return "revoked";
    } catch {
      return "kept"; // never sign out on a failure we can't classify
    } finally {
      checking = false;
    }
  };
}
