/**
 * Password sign-in / sign-up error mapping — the email/password sibling of
 * `mapOAuthError`. Supabase throws `AuthError` (and `AuthRetryableFetchError`
 * for network) with a `.message`, plus `.code`/`.status` on newer supabase-js.
 * We turn those into friendly, security-safe copy and say *where* to show it:
 * a specific field (inline) or the form-level banner.
 *
 * Security note: sign-in failures are intentionally collapsed to one generic
 * "email or password is incorrect" so we never reveal whether an account
 * exists for a given email.
 */

export type AuthErrorTarget = "form" | "email" | "password";

export interface MappedAuthError {
  target: AuthErrorTarget;
  message: string;
}

interface RawAuthError {
  message?: string;
  code?: string;
  status?: number;
  name?: string;
}

export function mapAuthError(error: unknown, ctx: "signin" | "signup"): MappedAuthError {
  const err = (error ?? {}) as RawAuthError;
  const raw = (err.message ?? "").trim();
  const text = raw.toLowerCase();
  const code = (err.code ?? "").toLowerCase();
  const status = typeof err.status === "number" ? err.status : undefined;

  // Network / can't reach Supabase — retryable, keep it actionable.
  if (
    err.name === "AuthRetryableFetchError" ||
    text.includes("network request failed") ||
    text.includes("failed to fetch") ||
    text.includes("network error")
  ) {
    return {
      target: "form",
      message: "Can't reach the server. Check your connection and try again.",
    };
  }

  // Rate limited.
  if (
    status === 429 ||
    code.includes("rate_limit") ||
    code.includes("over_request_rate") ||
    text.includes("rate limit") ||
    text.includes("too many requests")
  ) {
    return {
      target: "form",
      message: "Too many attempts. Please wait a minute and try again.",
    };
  }

  // Email not yet confirmed (project requires confirmation before sign-in).
  if (code === "email_not_confirmed" || text.includes("email not confirmed")) {
    return {
      target: "form",
      message: "Please confirm your email first — check your inbox for the verification link.",
    };
  }

  if (ctx === "signup") {
    // Account already exists — actionable on the email field.
    if (
      code === "user_already_exists" ||
      code === "email_exists" ||
      text.includes("already registered") ||
      text.includes("already exists") ||
      text.includes("user already registered")
    ) {
      return {
        target: "email",
        message: "An account with this email already exists. Try signing in instead.",
      };
    }
    // Password rejected by the server's strength policy.
    if (
      code === "weak_password" ||
      text.includes("weak password") ||
      text.includes("password should be")
    ) {
      return {
        target: "password",
        message: "Choose a stronger password (at least 6 characters).",
      };
    }
    if (text.includes("signups not allowed") || text.includes("signup is disabled")) {
      return {
        target: "form",
        message: "Sign-ups are currently disabled. Please try again later.",
      };
    }
  }

  // Sign-in: collapse all credential failures to one generic message.
  if (
    ctx === "signin" &&
    (code === "invalid_credentials" ||
      status === 400 ||
      text.includes("invalid login credentials") ||
      text.includes("invalid credentials"))
  ) {
    return {
      target: "form",
      message: "The email or password you entered is incorrect.",
    };
  }

  return {
    target: "form",
    message: raw || "Something went wrong. Please try again.",
  };
}
