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

/**
 * Default deadlines for supabase-js's own requests (auth, storage, REST), which
 * otherwise carry none. Same as the API client: 45s, and storage uploads get
 * the size-scaled upload deadline below. A token refresh that never answered used to hold `getSession()` --
 * and every API call waiting on it -- indefinitely.
 *
 * A timed-out request rejects like a dropped connection, which supabase-js
 * already treats as retryable: the session is kept, nobody is signed out.
 * A caller that passes its own signal keeps full control.
 */
export const SUPABASE_FETCH_TIMEOUT_MS = 45000;

/**
 * How long an UPLOAD may take before we give up: scaled to its size.
 *
 * A flat 90s would kill legitimate uploads on a weak Indian mobile uplink.
 * Servers accept files up to 10 MB (several at once for parcel photos and
 * dispute evidence), and phone photos are re-encoded but not resized (2-5 MB).
 * At ~0.5 Mbit/s (64 KB/s), the slow end of a poor 3G/4G signal, 10 MB takes
 * ~160s. So: 60s of headroom + time to send the body at 64 KB/s, never less
 * than 90s, never more than 10 minutes. A hung SMALL upload still fails fast.
 *
 * Not an idle/no-progress timeout: fetch (browser, React Native and supabase-js
 * storage) exposes no upload progress, so "no bytes for N seconds" cannot be
 * observed without moving every upload onto XMLHttpRequest.
 * Same formula in web and mobile src/integrations/supabase/authFetch.ts.
 */
export const UPLOAD_MIN_TIMEOUT_MS = 90_000;
export const UPLOAD_MAX_TIMEOUT_MS = 600_000;
const UPLOAD_FLOOR_BYTES_PER_SEC = 64 * 1024;

export function uploadTimeoutMs(bytes: number | undefined): number {
  if (bytes === undefined || !Number.isFinite(bytes)) return UPLOAD_MAX_TIMEOUT_MS;
  const ms = 60_000 + Math.ceil((bytes / UPLOAD_FLOOR_BYTES_PER_SEC) * 1000);
  return Math.min(UPLOAD_MAX_TIMEOUT_MS, Math.max(UPLOAD_MIN_TIMEOUT_MS, ms));
}

/** Size of a request body in bytes, or undefined when it cannot be known up front. */
export function bodyBytes(body: unknown): number | undefined {
  if (body === undefined || body === null) return 0;
  if (typeof body === "string") return body.length;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof Blob !== "undefined" && body instanceof Blob) return body.size;
  const entries = (body as { entries?: () => Iterable<[string, unknown]> }).entries;
  if (typeof FormData !== "undefined" && body instanceof FormData && typeof entries === "function") {
    let total = 0;
    for (const [, value] of entries.call(body)) {
      if (typeof value === "string") total += value.length;
      else if (typeof Blob !== "undefined" && value instanceof Blob) total += value.size;
      else return undefined;
    }
    return total;
  }
  return undefined;
}


function timedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  if (init?.signal) return globalThis.fetch(input, init);
  const ms = requestUrl(input).includes("/storage/v1/") ? uploadTimeoutMs(bodyBytes(init?.body)) : SUPABASE_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return globalThis
    .fetch(input, { ...init, signal: controller.signal })
    .catch((error: unknown) => {
      if (controller.signal.aborted) throw new Error("The request timed out. Please try again.");
      throw error;
    })
    .finally(() => clearTimeout(timer));
}

export const resilientAuthFetch: typeof fetch = async (input, init) => {
  const response = await timedFetch(input, init);
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
