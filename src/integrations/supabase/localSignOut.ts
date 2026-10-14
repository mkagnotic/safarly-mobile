/**
 * Sign out of THIS device, even when the server can't be reached.
 *
 * supabase-js `signOut({ scope: "local" })` first calls the server and, on a
 * network error or a 5xx, returns the error WITHOUT removing the stored
 * session (auth-js GoTrueClient `_signOut`, v2.104). The app then showed
 * "Sign out failed" and kept the person signed in, after it had already
 * unregistered their push token and dropped their Google session: half signed
 * out. Someone tapping "Sign out" on a shared phone, offline, stayed in.
 *
 * Local scope never revokes other devices, so finishing locally loses nothing:
 * the server-side session simply expires unused. `_removeSession` is the step
 * signOut itself runs on success (clears the stored session and fires
 * SIGNED_OUT, which AuthContext handles); it is private, so it is feature-
 * checked, with removing the stored session directly as the fallback.
 */
interface AuthLike {
  signOut(options: { scope: "local" }): Promise<{ error: unknown }>;
}

export async function signOutThisDevice(
  auth: AuthLike,
  removeStoredSession: () => Promise<void>,
): Promise<{ offline: boolean }> {
  const { error } = await auth.signOut({ scope: "local" });
  if (!error) return { offline: false };
  const remove = (auth as unknown as { _removeSession?: () => Promise<void> })._removeSession;
  if (typeof remove === "function") await remove.call(auth);
  else await removeStoredSession();
  return { offline: true };
}
