/**
 * Thrown when the user dismisses the Google account picker. Lives here so
 * the native and web entrypoints can re-export the same class — keeps
 * `instanceof AuthCancelledError` correct across platform bundles.
 */
export class AuthCancelledError extends Error {
  constructor() {
    super("Google sign-in was cancelled");
    this.name = "AuthCancelledError";
  }
}

/**
 * OAuth error mapping — ported verbatim from the web app so both clients
 * surface the exact same wording when a Google identity collides with a
 * password account.
 */
export function mapOAuthError(raw: string, code: string | null): string {
  const text = raw.toLowerCase();
  const c = (code ?? "").toLowerCase();
  if (
    c === "email_exists" ||
    c === "user_already_exists" ||
    c === "identity_already_exists" ||
    c === "identity_linked_to_another_user" ||
    text.includes("already registered") ||
    text.includes("already exists") ||
    text.includes("identity is already linked") ||
    text.includes("identity already linked")
  ) {
    return "This email is registered with a password. Please sign in with email and password.";
  }
  return raw;
}
