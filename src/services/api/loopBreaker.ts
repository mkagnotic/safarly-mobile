/**
 * App-wide runaway-loop breaker (29 Oct 2026).
 *
 * 1.1.1 shipped a push-registration loop that POSTed /user-handler/me/push-token
 * ~4 times a second from every phone, starving user-handler on prod so Profile,
 * My Travels and Chat stopped loading. Any future loop of the same shape (a
 * listener or effect that re-triggers its own request) is stopped HERE, on the
 * phone, before it reaches the server: a burst far beyond what a person can
 * cause is refused locally for a cool-down.
 *
 * Kept free of app imports so the node test runner can exercise it.
 */

/** Calls to one endpoint (method + path, no query) allowed per window. */
export const LOOP_LIMIT_WRITE = 20;
export const LOOP_LIMIT_READ = 60;
export const LOOP_WINDOW_MS = 10_000;
/** How long an endpoint stays blocked once tripped. */
export const LOOP_COOLDOWN_MS = 60_000;

const hits = new Map<string, number[]>();
const blockedUntil = new Map<string, number>();

export function loopKey(method: string, path: string): string {
  return `${method.toUpperCase()} ${path.split("?")[0]}`;
}

/** Records a call; returns false when this endpoint is in a runaway burst. */
export function allowCall(method: string, path: string, now = Date.now()): boolean {
  const key = loopKey(method, path);
  const until = blockedUntil.get(key);
  if (until !== undefined && now < until) return false;
  const limit = method.toUpperCase() === "GET" ? LOOP_LIMIT_READ : LOOP_LIMIT_WRITE;
  const recent = (hits.get(key) ?? []).filter((t) => now - t < LOOP_WINDOW_MS);
  recent.push(now);
  hits.set(key, recent);
  if (recent.length > limit) {
    blockedUntil.set(key, now + LOOP_COOLDOWN_MS);
    hits.set(key, []);
    // eslint-disable-next-line no-console
    console.warn(`[api] runaway loop stopped: ${key} (${recent.length} calls in ${LOOP_WINDOW_MS / 1000}s)`);
    return false;
  }
  return true;
}

/** Test helper. */
export function resetLoopBreaker(): void {
  hits.clear();
  blockedUntil.clear();
}
