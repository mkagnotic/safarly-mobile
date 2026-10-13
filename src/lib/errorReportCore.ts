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

/** The request body. Lengths are capped here and again by the server. */
export function buildPayload(report: ErrorReport, platform: MobilePlatform, appVersion: string | null) {
  return {
    platform,
    app_version: appVersion,
    route: report.screen ?? null,
    message: String(report.message ?? "").slice(0, 1000),
    stack: report.stack ? String(report.stack).slice(0, 8000) : null,
    request_id: report.requestId ?? null,
  };
}
