/**
 * A token refresh that fails with a 5xx must never end the session.
 *
 * Mirrors web's `src/integrations/supabase/authFetch.ts`.
 *
 * supabase-js decides whether a failed refresh is fatal from the status alone.
 * A network error or a 502/503/504 counts as "retryable": the session is kept
 * and the refresh is tried again. Anything else, a 500 included, makes it
 * delete the stored session and fire SIGNED_OUT.
 *
 * Production auth answers 500 when its database connection times out (seen on
 * 2026-09-16: "error finding refresh token: failed to connect ... operation was
 * canceled"). So a busy database was logging users out mid-session, and they
 * stayed logged out after it recovered.
 *
 * The same goes for a 429. Auth rate-limits token refreshes per IP (150 per 5
 * minutes), so an office or a carrier NAT sharing one address could trip it,
 * and the library would log the user out for being rate-limited.
 *
 * Neither a 5xx nor a 429 says anything about whether the refresh token is
 * valid, so both are reported to the library as a 503. A real rejection is
 * another 4xx (refresh_token_not_found, session_not_found, ...) and still
 * signs the user out exactly as before.
 */
const RETRYABLE_STATUS = 503;

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

export function isTokenRefreshRequest(input: RequestInfo | URL): boolean {
  const url = requestUrl(input);
  return url.includes("/auth/v1/token") && url.includes("grant_type=refresh_token");
}

export const resilientAuthFetch: typeof fetch = async (input, init) => {
  const response = await globalThis.fetch(input, init);
  const transient = response.status >= 500 || response.status === 429;
  if (!transient || response.status === RETRYABLE_STATUS) return response;
  if (!isTokenRefreshRequest(input)) return response;

  // Read as text rather than passing `response.body`: React Native's fetch has
  // no streaming bodies.
  const body = await response.text();
  return new Response(body, {
    status: RETRYABLE_STATUS,
    statusText: "Service Unavailable",
    headers: response.headers,
  });
};
