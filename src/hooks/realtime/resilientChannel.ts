/**
 * Self-healing Supabase realtime channels (client, iPhone, 23 Oct 2026).
 *
 * ⚠️ iOS suspends the app's socket in the background. Channels were created
 * once with a bare `.subscribe()`: when the socket died they never came back,
 * so an OPEN chat stopped receiving new messages and offer cards - the other
 * person's counter-offer only appeared after logging out and in (which rebuilds
 * every channel). Now:
 *  - a channel that reports CHANNEL_ERROR / TIMED_OUT / CLOSED is rebuilt,
 *    with backoff;
 *  - after any recovery AND whenever the app returns to the foreground, the
 *    owner re-fetches (`onRecover`), because events sent while the socket was
 *    down are gone for good.
 */

/** Statuses after which a channel will not deliver anything until rebuilt. */
export function isDeadChannelStatus(status: string): boolean {
  return status === "CHANNEL_ERROR" || status === "TIMED_OUT" || status === "CLOSED";
}

const BACKOFF_MS = [2_000, 5_000, 10_000, 30_000];

/** Delay before rebuild attempt `n` (0-based): 2s, 5s, 10s, then every 30s. */
export function reconnectDelayMs(attempt: number): number {
  return BACKOFF_MS[Math.min(Math.max(attempt, 0), BACKOFF_MS.length - 1)];
}
