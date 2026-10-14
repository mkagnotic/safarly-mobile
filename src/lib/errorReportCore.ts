/**
 * Pure parts of the error reporter (no React Native imports, so they run under
 * `node --test`). The wiring lives in ./errorReporter.ts.
 *
 * Reports go to POST /error-handler/report → public.app_errors → the web
 * Admin → Errors page. Same rules as the web reporter: no noise, no floods.
 */

export type MobilePlatform = "android" | "ios";

export interface ErrorReport {
  message: string;
  stack?: string | null;
  screen?: string | null;
  requestId?: string | null;
}

const NOISE: RegExp[] = [
  /network request failed|failed to fetch|networkerror|load failed|timed? ?out/i,
  /AbortError|aborted/i,
];

/** True when this error is worth a report. */
export function isReportable(message: string): boolean {
  if (!message || !message.trim()) return false;
  return !NOISE.some((re) => re.test(message));
}

const WINDOW_MS = 5 * 60 * 1000;
const MAX_PER_SESSION = 10;

/** One per distinct error per 5 minutes, at most 10 per app session. */
export function createThrottle(now: () => number = Date.now) {
  const lastSent = new Map<string, number>();
  let sent = 0;
  return (key: string): boolean => {
    if (sent >= MAX_PER_SESSION) return false;
    const t = now();
    const prev = lastSent.get(key);
    if (prev !== undefined && t - prev < WINDOW_MS) return false;
    lastSent.set(key, t);
    sent++;
    return true;
  };
}

/**
 * Masks secrets and personal data BEFORE a report leaves the device. The server
 * scrubs again (supabase/functions/_shared/errorReport.ts, same rules), but a
 * token or a phone number should never travel in the first place.
 */
const SCRUBBERS: Array<[RegExp, string]> = [
  // JWTs (session tokens, anon keys) and bearer tokens.
  [/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/g, "<jwt>"],
  [/\b(bearer)\s+[A-Za-z0-9._~+/=-]{12,}/gi, "$1 <token>"],
  // Tokens inside JSON text, e.g. a logged session object.
  [/("(?:access_token|refresh_token|provider_token|provider_refresh_token|password|otp|token)"\s*:\s*")[^"]*"/gi, '$1<redacted>"'],
  // Stripe / Supabase / generic secret-looking keys.
  [/\b(sk|pk|rk|whsec|sb_secret|sb_publishable)_[A-Za-z0-9_]{8,}/g, "<key>"],
  // Values of sensitive query parameters.
  [/([?&](?:token|access_token|refresh_token|code|key|apikey|password|otp|secret)=)[^&#\s]+/gi, "$1<redacted>"],
  // Email addresses. Bounded to real limits (64 / 253): the unbounded form was
  // quadratic on a long run of letters (300ms per 8 KB) - at crash time, on the
  // JS thread.
  [/[A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9.-]{1,253}\.[A-Za-z]{2,24}\b/g, "<email>"],
  // Phone numbers however they are written: +1 (555) 123-4567, +91.98765.43210 ...
  [/\+?\(?\d{1,4}\)?[\s.-]?\(?\d{2,5}\)?[\s.-]\d{2,5}[\s.-]?\d{2,5}\b/g, "<number>"],
  // Long digit runs: card numbers, phone numbers.
  [/\b\d[\d -]{7,}\d\b/g, "<number>"],
  // A bare 6-digit code (the delivery OTP and email codes are 6 digits).
  [/\b\d{6}\b/g, "<code>"],
];

export function scrub(value: string): string {
  let s = value;
  for (const [re, rep] of SCRUBBERS) s = s.replace(re, rep);
  return s;
}

/** The request body. Scrubbed and capped here, and again by the server. */
export function buildPayload(report: ErrorReport, platform: MobilePlatform, appVersion: string | null) {
  return {
    platform,
    app_version: appVersion,
    route: report.screen ? scrub(String(report.screen)).slice(0, 300) : null,
    message: scrub(String(report.message ?? "")).slice(0, 1000),
    stack: report.stack ? scrub(String(report.stack)).slice(0, 8000) : null,
    request_id: report.requestId ?? null,
  };
}
