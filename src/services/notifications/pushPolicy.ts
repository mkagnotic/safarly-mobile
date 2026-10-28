/**
 * Push is ONE account setting (`push_enabled`) shared by every device; each
 * device still needs its own OS permission + token. Pure, so it is tested
 * without React Native (28 Oct 2026).
 *
 * Before: each device showed the switch as `push_enabled && this phone's
 * permission`, so a second phone read OFF and never registered until the user
 * flipped the switch there too.
 */
export interface DevicePush {
  /** The account setting. A missing preferences row means ON (server default). */
  accountOn: boolean;
  granted: boolean;
  canAskAgain: boolean;
}

/**
 * What this phone shows under the switch.
 *   off      - the account setting is off
 *   ready    - allowed here; this phone is (or gets) registered
 *   allow    - not allowed yet, but the OS can still ask
 *   blocked  - the OS won't ask again; only Settings can turn it on
 */
export type DevicePushState = "off" | "ready" | "allow" | "blocked";

export function devicePushState(d: DevicePush): DevicePushState {
  if (!d.accountOn) return "off";
  if (d.granted) return "ready";
  return d.canAskAgain ? "allow" : "blocked";
}

/**
 * On sign-in / app start: register silently when allowed; ask ONCE per phone
 * when the account is on and the OS can still ask (iOS starts every app at
 * "undetermined" - production had 0 iOS tokens because the only prompt lived
 * behind the toggle); otherwise do nothing - Preferences explains why.
 */
export type StartupPushAction = "register" | "ask" | "none";

export function startupPushAction(d: DevicePush & { askedBefore: boolean }): StartupPushAction {
  const state = devicePushState(d);
  if (state === "ready") return "register";
  if (state === "allow" && !d.askedBefore) return "ask";
  return "none";
}

/** The account setting from a preferences payload; no row means ON (28 Oct 2026). */
export function accountPushOn(prefs: { push_enabled?: boolean | null } | null | undefined): boolean {
  return prefs?.push_enabled !== false;
}

/**
 * How a push that arrives while the app is open is presented (27 Oct 2026).
 * Signed out: never shown. For the chat on screen: no banner/sound/list entry
 * (the message is already in front of the user), like every chat app.
 *
 * App active (in front): exactly ONE notice per event - the in-app banner
 * (useRealtimeSync), which skips the chat on screen the same way. The OS
 * banner showed as well, so every event came twice (29 Oct 2026). Web's rule:
 * a visible Safarly tab gets the toast, never also a system notification
 * (public/sw.js). The badge still updates.
 */
export function foregroundPresentation(s: {
  signedIn: boolean;
  /** AppState is "active": the in-app banner shows it instead (29 Oct 2026). */
  appActive: boolean;
  conversationId?: string | null;
  activeConversationId: string | null;
}): { show: boolean; badge: boolean } {
  const forOpenChat = !!s.conversationId && s.conversationId === s.activeConversationId;
  return { show: s.signedIn && !s.appActive && !forOpenChat, badge: s.signedIn };
}
