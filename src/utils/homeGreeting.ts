/**
 * Home greeting: "Welcome, {first name}" on a brand-new account, "Welcome back,
 * {first name}" after that (client report 29 Oct 2026: a user who had just
 * signed up was told "Welcome back").
 *
 * "New" is decided from the SERVER's `profiles.created_at`, not a device flag,
 * so it is the same on every phone and survives a reinstall: an account is new
 * for its first 24 hours. Pure (no React Native) so node:test runs it.
 */

/** An account is "new" for this long after its profile row was created. */
export const NEW_ACCOUNT_WINDOW_MS = 24 * 60 * 60 * 1000;

export function isNewAccount(createdAt: string | null | undefined, now: number = Date.now()): boolean {
  if (!createdAt) return false;
  const t = Date.parse(createdAt);
  if (Number.isNaN(t)) return false;
  // A created_at slightly in the future (device clock behind) is still new.
  return now - t < NEW_ACCOUNT_WINDOW_MS;
}

/** First word of the display name; "" when there is none. */
export function firstName(name: string | null | undefined): string {
  return (name ?? "").trim().split(/\s+/)[0] ?? "";
}

/** The greeting word(s), without the name: "Welcome" or "Welcome back". */
export function greetingWord(createdAt: string | null | undefined, now: number = Date.now()): "Welcome" | "Welcome back" {
  return isNewAccount(createdAt, now) ? "Welcome" : "Welcome back";
}

/** The full line, e.g. "Welcome, Asha" / "Welcome back, Asha" / "Welcome back". */
export function homeGreeting(
  profile: { name?: string | null; created_at?: string | null } | null | undefined,
  now: number = Date.now(),
): string {
  const word = greetingWord(profile?.created_at, now);
  const first = firstName(profile?.name);
  return first ? `${word}, ${first}` : word;
}
