import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";

import { navigationRef } from "@/navigation/navigationRef";
import { notificationsApi, usersApi } from "@/services/api";
import { bumpRealtimeTopic } from "@/store/realtimeBus";
import { useAppStore } from "@/store/useAppStore";

import {
  resolveNotificationRoute,
  type NotificationTarget,
} from "./notificationRoute";
import { tappedNotificationIds, type NotificationTap } from "./notificationTap";
import { foregroundPresentation, shouldReregisterOnTokenEvent, startupPushAction } from "./pushPolicy";

/** Persists the last Expo token so we can deregister it on sign-out. */
const LAST_TOKEN_KEY = "safarly.pushToken";
/** A token a sign-out could not unlink (offline); retried on the next start. */
const PENDING_FORGET_KEY = "safarly.pushTokenToForget";
/** This phone has shown the OS permission dialog once already: never nag (28 Oct 2026). */
const ASKED_ONCE_KEY = "safarly.pushAskedOnce";

/**
 * The chat on screen right now. A push for it shows no banner (the message is
 * already in front of the user) - every chat app works this way (27 Oct 2026).
 */
let activeConversationId: string | null = null;
export function setActiveChat(conversationId: string | null): void {
  activeConversationId = conversationId;
}
/** Android needs an explicit channel for heads-up notifications + sound. */
const ANDROID_CHANNEL_ID = "default";

type DevicePlatform = "ios" | "android";

export type PushRegisterReason = "unsupported" | "no-project" | "denied" | "error";

export interface PushRegisterResult {
  ok: boolean;
  reason?: PushRegisterReason;
}

let handlerConfigured = false;

/**
 * Sets the foreground presentation behaviour. Idempotent — safe to call on every
 * mount. Uses the SDK 54 fields (`shouldShowBanner`/`shouldShowList`); the older
 * `shouldShowAlert` is deprecated.
 */
export function configureNotifications(): void {
  if (handlerConfigured) return;
  handlerConfigured = true;
  Notifications.setNotificationHandler({
    handleNotification: async (notification) => {
      const data = notification.request.content.data as { conversation_id?: string } | undefined;
      // Signed out: nothing for this device should show, even if a push slips
      // through before the server unlinks it.
      // App open and in front: the in-app banner (useRealtimeSync) is the one
      // notice for this event, so the OS adds none - web's rule (29 Oct 2026).
      const { show, badge } = foregroundPresentation({
        signedIn: useAppStore.getState().authenticated,
        appActive: AppState.currentState === "active",
        conversationId: data?.conversation_id,
        activeConversationId,
      });
      return { shouldShowBanner: show, shouldShowList: show, shouldPlaySound: show, shouldSetBadge: badge };
    },
  });
}

async function ensureAndroidChannel(): Promise<void> {
  if (Platform.OS !== "android") return;
  await Notifications.setNotificationChannelAsync(ANDROID_CHANNEL_ID, {
    name: "Default",
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: "#FF7A26",
  });
}

/**
 * The EAS project id, required by `getExpoPushTokenAsync`. Written into
 * `app.json` by `eas init` (`expo.extra.eas.projectId`). Absent until the app is
 * linked to an EAS project — until then push token acquisition is skipped.
 */
function getProjectId(): string | undefined {
  const extra = Constants.expoConfig?.extra as
    | { eas?: { projectId?: string } }
    | undefined;
  const id = extra?.eas?.projectId;
  return typeof id === "string" && id.length > 0 ? id : undefined;
}

/** Physical device + native support required — Expo Go (SDK 54) and web can't mint tokens. */
function pushSupported(): boolean {
  // EXPO_PUBLIC_PUSH_ON_EMULATOR=1 is for test builds only: a Google-APIs emulator
  // can receive FCM, which is how push delivery is verified without a phone.
  return Platform.OS !== "web" && (Device.isDevice || process.env.EXPO_PUBLIC_PUSH_ON_EMULATOR === "1");
}

/**
 * Whether push can work at all on this build and device, before asking the OS
 * for anything.
 *
 * - `unsupported`: web, a simulator or emulator — no push token can be minted.
 * - `not-configured`: the build is not linked to an EAS project, so there is no
 *   Expo push token to register (see `.env.example`).
 *
 * Screens use this to disable the push toggle with an explanation, rather than
 * letting someone switch it on only to watch it switch itself back off.
 */
export type PushAvailability = "available" | "unsupported" | "not-configured";

export function getPushAvailability(): PushAvailability {
  if (!pushSupported()) return "unsupported";
  if (!getProjectId()) return "not-configured";
  return "available";
}

/** The OS notification permission, without prompting. */
export async function getPushPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  if (!pushSupported()) return { granted: false, canAskAgain: false };
  try {
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    return { granted: status === "granted", canAskAgain: canAskAgain !== false };
  } catch {
    return { granted: false, canAskAgain: true };
  }
}

/**
 * The registration in flight, if any. Fetching the token makes expo-notifications
 * emit a "token changed" event (see `shouldReregisterOnTokenEvent`), so while
 * this is set every such event is our own echo and must be ignored. It also
 * coalesces concurrent callers into one request.
 */
let registering: Promise<void> | null = null;
/** The device (FCM/APNs) token we last saw from our own fetch, this app run. */
let lastDeviceToken: string | null = null;
/** The Expo token the server already has from this app run. */
let registeredThisRun: string | null = null;

/** Fetches the Expo token, registers it with the backend, and caches it. */
function acquireAndRegister(projectId: string): Promise<void> {
  if (registering) return registering;
  registering = (async () => {
    try {
      await doAcquireAndRegister(projectId);
    } finally {
      // Let the echo events of our own fetch drain before accepting new ones.
      setTimeout(() => { registering = null; }, 2000);
    }
  })();
  return registering;
}

async function doAcquireAndRegister(projectId: string): Promise<void> {
  await ensureAndroidChannel();
  try {
    lastDeviceToken = (await Notifications.getDevicePushTokenAsync()).data as string;
  } catch {
    // Keep going: the Expo token below is what the server needs.
  }
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  // Same token already registered this run: nothing to tell the server.
  if (registeredThisRun === token) return;
  const platform: DevicePlatform = Platform.OS === "ios" ? "ios" : "android";
  await usersApi.registerPushToken(token, platform);
  registeredThisRun = token;
  await AsyncStorage.setItem(LAST_TOKEN_KEY, token);
}

/**
 * Interactive: request OS permission (prompting if needed), then register a
 * token. Call from the Preferences push toggle. Never throws — returns a result
 * the caller can turn into a toast.
 */
export async function requestAndRegisterPushToken(): Promise<PushRegisterResult> {
  try {
    if (!pushSupported()) return { ok: false, reason: "unsupported" };
    const projectId = getProjectId();
    if (!projectId) return { ok: false, reason: "no-project" };

    let { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") {
      await AsyncStorage.setItem(ASKED_ONCE_KEY, "1").catch(() => undefined);
      status = (await Notifications.requestPermissionsAsync()).status;
    }
    if (status !== "granted") return { ok: false, reason: "denied" };

    await acquireAndRegister(projectId);
    return { ok: true };
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] requestAndRegisterPushToken failed", err);
    return { ok: false, reason: "error" };
  }
}

/** Who this phone last synced push for in this app run; cleared on sign-out. */
let syncedFor: string | null = null;

/**
 * Push is one account setting for every device (28 Oct 2026). Called when the
 * profile (which carries the preferences) loads - i.e. on sign-in AND on app
 * start - once per account per app run. Account ON and this phone allowed ->
 * register silently; never asked here -> ask ONCE (see `startupPushAction`).
 * Best-effort; swallows all errors.
 */
export async function syncPushForAccount(accountKey: string, accountOn: boolean): Promise<void> {
  if (syncedFor === accountKey) return;
  syncedFor = accountKey;
  try {
    if (!pushSupported()) return;
    const projectId = getProjectId();
    if (!projectId) return;
    const { status, canAskAgain } = await Notifications.getPermissionsAsync();
    const askedBefore = (await AsyncStorage.getItem(ASKED_ONCE_KEY)) === "1";
    const action = startupPushAction({
      accountOn,
      granted: status === "granted",
      canAskAgain: canAskAgain !== false,
      askedBefore,
    });
    if (action === "none") return;
    if (action === "ask") {
      await AsyncStorage.setItem(ASKED_ONCE_KEY, "1");
      if ((await Notifications.requestPermissionsAsync()).status !== "granted") return;
    }
    await acquireAndRegister(projectId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] syncPushForAccount failed", err);
  }
}

/**
 * Remove this device's token server-side. Call from `signOut` BEFORE the
 * Supabase session is torn down — afterwards the JWT is gone and the DELETE
 * would 401. Best-effort; never throws.
 */
export async function unregisterPushToken(): Promise<void> {
  await forgetThisDevice();
}

/**
 * Unlink this phone from the account on EVERY sign-out (27 Oct 2026): the normal
 * sign-out's DELETE never worked (it sent the token where the server didn't read
 * it), and the forced sign-outs (refused / revoked session) only forgot it
 * locally - so a signed-out phone kept getting the account's notifications.
 * Needs no session. If the phone is offline, the token is kept and retried on
 * the next start (`retryPendingForget`). Never throws.
 */
export async function forgetThisDevice(): Promise<void> {
  syncedFor = null; // the next sign-in syncs again
  // Signed out: the previous account's unread count must not stay on the icon.
  if (Platform.OS !== "web") void Notifications.setBadgeCountAsync(0).catch(() => undefined);
  try {
    const token = await AsyncStorage.getItem(LAST_TOKEN_KEY);
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
    if (!token) return;
    try {
      await usersApi.forgetPushToken(token);
      await AsyncStorage.removeItem(PENDING_FORGET_KEY);
    } catch {
      await AsyncStorage.setItem(PENDING_FORGET_KEY, token);
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] forgetThisDevice failed", err);
  }
}

/** A sign-out that happened offline: unlink that token now (only while signed out). */
export async function retryPendingForget(): Promise<void> {
  try {
    const token = await AsyncStorage.getItem(PENDING_FORGET_KEY);
    if (!token || useAppStore.getState().authenticated) return;
    await usersApi.forgetPushToken(token);
    await AsyncStorage.removeItem(PENDING_FORGET_KEY);
  } catch {
    // still offline: try again next start
  }
}

/** Opening a chat clears its notifications from the tray, like any chat app. */
export async function dismissChatNotifications(conversationId: string): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    const shown = await Notifications.getPresentedNotificationsAsync();
    await Promise.all(
      shown
        .filter((n) => (n.request.content.data as { conversation_id?: string } | undefined)?.conversation_id === conversationId)
        .map((n) => Notifications.dismissNotificationAsync(n.request.identifier)),
    );
  } catch {
    // nothing to clear / not supported
  }
}

/**
 * Forget this device's cached token locally, without a server call. Used after
 * account deletion: the server has already removed every token for the account
 * and the session is gone, so the DELETE in `unregisterPushToken` would only 401.
 */
export async function clearCachedPushToken(): Promise<void> {
  try {
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
  } catch {
    // Nothing useful to do; the stale key is harmless once the account is gone.
  }
}

/**
 * Re-registers when the OS rotates this device's push token (reinstalls,
 * restores, FCM/APNs refreshes). Without it the server keeps sending to a dead
 * token and the user silently stops receiving pushes. Only acts for a device
 * that registered before and still has permission. Returns an unsubscribe.
 */
export function watchPushTokenRefresh(): () => void {
  if (getPushAvailability() !== "available") return () => {};
  const projectId = getProjectId();
  const sub = Notifications.addPushTokenListener((event) => {
    void (async () => {
      try {
        if (!projectId) return;
        // Our own token fetch emits this event: ignore the echo (29 Oct 2026 loop).
        if (registering) return;
        const previous = await AsyncStorage.getItem(LAST_TOKEN_KEY);
        const { granted } = await getPushPermission();
        const eventToken = typeof event?.data === "string" ? event.data : null;
        if (
          !shouldReregisterOnTokenEvent({
            eventToken,
            lastDeviceToken,
            registering: !!registering,
            optedIn: !!previous,
            granted,
          })
        ) {
          return;
        }
        lastDeviceToken = eventToken;
        registeredThisRun = null; // a genuinely new device token: tell the server
        await acquireAndRegister(projectId);
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn("[push] token refresh re-registration failed", err);
      }
    })();
  });
  return () => sub.remove();
}

// ───────────────────────── Tap → navigation bridge ─────────────────────────

/**
 * A tap can arrive before the navigator is ready or before auth rehydrates
 * (cold start from a killed app). Stash the target and flush it once both are
 * ready — see `flushPendingNotificationTarget`.
 */
let pendingTarget: NotificationTarget | null = null;
/** The tapped push to mark read once signed in (cold start replays it too). */
let pendingTap: NotificationTap | null = null;

/** Marks the tapped notification read and refreshes the bell + app badge. Best effort. */
async function markTappedRead(tap: NotificationTap): Promise<void> {
  try {
    let ids = tappedNotificationIds(tap, []);
    if (ids.length === 0 && !tap.id && tap.link) {
      const res = await notificationsApi.list({ page: 1, per_page: 50 });
      ids = tappedNotificationIds(tap, res?.data ?? []);
    }
    if (ids.length === 0) return;
    await Promise.all(ids.map((id) => notificationsApi.markAsRead(id).catch(() => {})));
    bumpRealtimeTopic("notifications");
  } catch {
    /* the notice just stays unread */
  }
}

function canNavigate(): boolean {
  // MainTabs exists only once profile setup is done: navigating to it from the
  // onboarding stack was silently dropped, so "Verify my identity" on the last
  // onboarding step landed on Home instead of the identity check (28 Oct 2026,
  // emulator). Until then the target waits and is replayed.
  const st = useAppStore.getState();
  return navigationRef.isReady() && st.authenticated && st.profileSetupDone;
}

function doNavigate(target: NotificationTarget): void {
  const nav = navigationRef.navigate as (name: string, params?: object) => void;
  // The legal pages are root-stack screens, not tabs (`/terms`, `/privacy`).
  if (target.root) {
    nav(target.screen);
    return;
  }
  // Every other target is a tab route nested under the root "MainTabs" stack
  // screen. The typed `navigate` can't express a computed nested route, so go
  // through the loosely-typed signature — every target is a real MainTab route.
  nav("MainTabs", {
    screen: target.screen,
    params: target.params,
  });
}

export function navigateToNotificationTarget(target: NotificationTarget, tap?: NotificationTap): void {
  if (canNavigate()) {
    doNavigate(target);
    if (tap) void markTappedRead(tap);
  } else {
    pendingTarget = target; // replayed by flushPendingNotificationTarget
    pendingTap = tap ?? null;
  }
}

/** Called once the navigator + auth are ready (see `usePushNotifications`). */
export function flushPendingNotificationTarget(): void {
  if (!pendingTarget || !canNavigate()) return;
  const target = pendingTarget;
  const tap = pendingTap;
  pendingTarget = null;
  pendingTap = null;
  doNavigate(target);
  if (tap) void markTappedRead(tap);
}

/** Routes a tapped notification (foreground/background/cold-start alike). */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const content = response.notification.request.content;
  const data = content.data as { link?: string; type?: string; notification_id?: string } | undefined;
  const target = resolveNotificationRoute(data?.link, data?.type, content.title);
  // Opening it marks it read (server sends notification_id; older pushes fall
  // back to link + type) and refreshes the bell and app badge (29 Oct 2026).
  navigateToNotificationTarget(target, { id: data?.notification_id, link: data?.link, type: data?.type });
}
