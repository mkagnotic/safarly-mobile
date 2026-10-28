/**
 * Connection banner rules - a port of web's `useConnectionStatus.ts` +
 * `ConnectionBanner.tsx`, so the phone and the browser say the same thing at
 * the same moment (29 Oct 2026). Pure: no React Native, no NetInfo import, so
 * node:test runs it without the native module.
 *
 * Web behaviour copied exactly:
 *   - "offline"      -> red "You're offline", shown at once (role alert).
 *   - "reconnecting" -> amber "Reconnecting…", only after a 1 s grace so brief
 *                       blips (and the first connect) never flash.
 *   - recovery       -> green "Back online" for 1.5 s, but only after a
 *                       degradation the user actually SAW.
 */

export type ConnectionStatus = "online" | "reconnecting" | "offline";

/** Same 1 s grace as web before "Reconnecting…" appears. */
export const RECONNECT_GRACE_MS = 1000;
/** Same 1.5 s "Back online" pill as web. */
export const BACK_ONLINE_MS = 1500;

/**
 * The status, from the raw signals.
 *
 * NetInfo plays the part of web's `navigator.onLine` + server probe:
 * `isConnected` is the network, `isInternetReachable` is NetInfo's own
 * reachability probe. `null` means "not known yet" (every app start begins
 * there) and is NEVER offline - otherwise the banner would flash red on launch.
 * Only an explicit `false` counts, and a failed probe beats a socket that still
 * claims "open" (a dropped network leaves the socket looking open until its
 * heartbeat times out - web N02b, 27 Oct 2026).
 */
export function resolveConnectionStatus(s: {
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  realtimeOpen: boolean;
  /** Has the realtime socket been open at least once since launch? */
  hasConnected: boolean;
}): ConnectionStatus {
  if (s.isConnected === false || s.isInternetReachable === false) return "offline";
  // Only a socket that WAS open can be reconnecting; the first connect is silent.
  if (!s.realtimeOpen) return s.hasConnected ? "reconnecting" : "online";
  return "online";
}

export type BannerTone = "danger" | "warning" | "safe";

export interface BannerVariant {
  label: "You're offline" | "Reconnecting…" | "Back online";
  tone: BannerTone;
  /** "alert" is announced at once (assertive); "status" politely. */
  role: "alert" | "status";
}

/** Which pill to show, or null for none. Same priority as web: offline > reconnecting > back online. */
export function bannerVariant(s: {
  status: ConnectionStatus;
  /** The 1 s reconnect grace has elapsed while still reconnecting. */
  reconnectingVisible: boolean;
  showBackOnline: boolean;
}): BannerVariant | null {
  if (s.status === "offline") return { label: "You're offline", tone: "danger", role: "alert" };
  if (s.status === "reconnecting" && s.reconnectingVisible) {
    return { label: "Reconnecting…", tone: "warning", role: "status" };
  }
  if (s.showBackOnline) return { label: "Back online", tone: "safe", role: "status" };
  return null;
}

/**
 * Did the user SEE a degradation? Only then does recovery earn a "Back online".
 * A hidden first-connect "reconnecting" (still inside the grace) does not count -
 * web made every navigation end with "Back online" until it learned this.
 */
export function degradationWasVisible(status: ConnectionStatus, reconnectingVisible: boolean): boolean {
  return status === "offline" || (status === "reconnecting" && reconnectingVisible);
}
