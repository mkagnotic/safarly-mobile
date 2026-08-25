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
 * Ported verbatim from web (`src/services/auth/oauthErrors.ts`) so both clients say
 * exactly the same thing.
 *
 * Turns whatever Supabase/Google hand back into copy a person can act on.
 *
 * ⚠️ This function must NEVER return the raw provider text. It used to end with
 * `return raw`, so anything it did not recognise went straight to a toast — a client
 * was shown **"Unable to exchange external code: 4/0A"**, which is GoTrue quoting
 * Google's OAuth authorization code back at them. It says nothing about what went
 * wrong and nothing about what to do next.
 *
 * Unmapped errors are logged for diagnosis and replaced with a generic, actionable
 * message. If a new provider error starts appearing, the console is where it shows up
 * — add a case here rather than letting it through.
 */
export function mapOAuthError(raw: string, code: string | null): string {
  const text = (raw ?? "").toLowerCase();
  const c = (code ?? "").toLowerCase();

  // A Google identity whose email already belongs to a password account.
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

  // THE reported one. GoTrue could not redeem Google's authorization code — almost
  // always because it had already been used (a refresh, a back button, a re-opened
  // link) or because it expired. Both are fixed by simply starting again.
  if (
    text.includes("unable to exchange external code") ||
    text.includes("invalid_grant") ||
    c === "invalid_grant" ||
    c === "bad_code_verifier"
  ) {
    return "That sign-in link had already been used or expired. Please try signing in again.";
  }

  // The user dismissed Google's account picker / consent screen.
  if (c === "access_denied" || text.includes("access_denied") || text.includes("user denied")) {
    return "Sign-in was cancelled.";
  }

  // Stale tab, restarted flow, or a PKCE verifier that no longer matches.
  if (
    c === "bad_oauth_state" ||
    c === "flow_state_not_found" ||
    c === "flow_state_expired" ||
    text.includes("oauth state") ||
    text.includes("state mismatch") ||
    text.includes("code verifier") ||
    text.includes("flow state")
  ) {
    return "Your sign-in session expired. Please try signing in again.";
  }

  // Provider switched off or misconfigured — the user cannot fix it, so point them
  // at the route that does work.
  if (
    c === "provider_disabled" ||
    c === "unsupported_provider" ||
    text.includes("provider is not enabled") ||
    text.includes("unsupported provider")
  ) {
    return "Google sign-in isn't available right now. Please sign in with your email and password.";
  }

  if (
    text.includes("failed to fetch") ||
    text.includes("network request failed") ||
    text.includes("network error")
  ) {
    return "Can't reach the server. Check your connection and try again.";
  }

  if (c.includes("rate_limit") || text.includes("rate limit") || text.includes("too many")) {
    return "Too many attempts. Please wait a few minutes and try again.";
  }

  // ⚠️ Deliberately NOT `return raw`. Anything unrecognised is a technical string, not
  // a message for a user — keep it in the console and give them something actionable.
  if (raw) {
    // The console is the only place this text is allowed to exist. Intentional.
    // eslint-disable-next-line no-console
    console.warn("[oauth] unmapped provider error:", raw, code ? `(code: ${code})` : "");
  }
  return "We couldn't complete Google sign-in. Please try again, or sign in with your email and password.";
}
