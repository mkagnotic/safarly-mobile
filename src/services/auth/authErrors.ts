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
        // Wording tracks `passwordPolicy.PASSWORD_HINT`; not imported because
        // services/ shouldn't depend on features/.
        message: "Choose a stronger password — at least 8 characters, with letters and numbers.",
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

/**
 * Email one-time-code errors — `verifyEmailOtp` and `resendEmailOtp`.
 *
 * Supabase surfaces its resend throttle as a plain message ("For security
 * purposes, you can only request this after N seconds"), which is worth
 * passing through nearly verbatim: the user needs the number to know how long
 * to wait.
 */
export function mapOtpError(error: unknown): string {
  const err = (error ?? {}) as RawAuthError;
  const raw = (err.message ?? "").trim();
  const text = raw.toLowerCase();
  const code = (err.code ?? "").toLowerCase();
  const status = typeof err.status === "number" ? err.status : undefined;

  if (
    err.name === "AuthRetryableFetchError" ||
    text.includes("network request failed") ||
    text.includes("failed to fetch") ||
    text.includes("network error")
  ) {
    return "Can't reach the server. Check your connection and try again.";
  }

  // Supabase's own throttle copy already names the wait, so keep it.
  if (text.includes("for security purposes") || text.includes("only request this")) {
    return raw;
  }

  if (status === 429 || code.includes("rate_limit") || text.includes("too many requests")) {
    return "Too many attempts. Please wait a minute and try again.";
  }

  if (
    code === "otp_expired" ||
    text.includes("expired") ||
    text.includes("invalid") ||
    text.includes("token not found")
  ) {
    return "That code is invalid or has expired. Request a new one.";
  }

  return raw || "Something went wrong. Please try again.";
}

/**
 * Password-reset request errors (`authApi.forgotPassword`).
 *
 * Deliberately NOT `mapAuthError`: that mapper collapses any 400 in a `signin`
 * context to "email or password is incorrect", which is nonsense on a screen
 * with no password field.
 *
 * Security note: the endpoint always reports success so it can't be used to
 * enumerate accounts, so nothing here may hint at whether an email is
 * registered. Only transport- and policy-level failures reach the user.
 *
 * Duck-types the error rather than importing `ApiClientError` so this module
 * stays dependency-free; `ApiClientError` exposes the same
 * `message`/`code`/`status` surface as Supabase's `AuthError`.
 */
export function mapPasswordResetError(error: unknown): string {
  const err = (error ?? {}) as RawAuthError;
  const text = (err.message ?? "").trim().toLowerCase();
  const code = (err.code ?? "").toLowerCase();
  const status = typeof err.status === "number" ? err.status : undefined;

  if (
    err.name === "AuthRetryableFetchError" ||
    text.includes("network request failed") ||
    text.includes("failed to fetch") ||
    text.includes("network error")
  ) {
    return "Can't reach the server. Check your connection and try again.";
  }

  // The endpoint rate-limits per IP (10/15min) and per email (5/15min).
  if (status === 429 || code.includes("rate_limit") || text.includes("too many requests")) {
    return "Too many reset requests. Please wait a few minutes and try again.";
  }

  if (code === "validation_error" || status === 422) {
    return "Enter a valid email address.";
  }

  return "Something went wrong. Please try again.";
}
