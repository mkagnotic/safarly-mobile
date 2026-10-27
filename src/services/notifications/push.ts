import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Device from "expo-device";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { navigationRef } from "@/navigation/navigationRef";
import { usersApi } from "@/services/api";
import { useAppStore } from "@/store/useAppStore";

import {
  resolveNotificationRoute,
  type NotificationTarget,
} from "./notificationRoute";
import { foregroundPresentation, loginPushAction } from "./pushPolicy";

/** Persists the last Expo token so we can deregister it on sign-out. */
const LAST_TOKEN_KEY = "safarly.pushToken";
/** A token a sign-out could not unlink (offline); retried on the next start. */
const PENDING_FORGET_KEY = "safarly.pushTokenToForget";

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
      const { show, badge } = foregroundPresentation({
        signedIn: useAppStore.getState().authenticated,
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

/** Fetches the Expo token, registers it with the backend, and caches it. */
async function acquireAndRegister(projectId: string): Promise<void> {
  await ensureAndroidChannel();
  const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
  const platform: DevicePlatform = Platform.OS === "ios" ? "ios" : "android";
  await usersApi.registerPushToken(token, platform);
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

/**
 * On sign-in: register this device for push. Already allowed -> register
 * silently. Never asked (every new iPhone) -> ask ONCE, so the OS shows its
 * dialog; a user who already answered is never asked again. See
 * ./pushPolicy.ts for why: iOS had 0 registered devices because the only
 * prompt lived behind the Preferences toggle. Best-effort; swallows all errors.
 */
export async function syncPushRegistrationOnLogin(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const projectId = getProjectId();
    if (!projectId) return;
    let { status } = await Notifications.getPermissionsAsync();
    const action = loginPushAction(status);
    if (action === "skip") return;
    if (action === "ask") {
      status = (await Notifications.requestPermissionsAsync()).status;
      if (status !== "granted") return;
    }
    await acquireAndRegister(projectId);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] syncPushRegistrationOnLogin failed", err);
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
  const sub = Notifications.addPushTokenListener(() => {
    void (async () => {
      try {
        if (!projectId) return;
        const previous = await AsyncStorage.getItem(LAST_TOKEN_KEY);
        if (!previous) return; // never opted in on this device
        const { granted } = await getPushPermission();
        if (!granted) return;
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

function canNavigate(): boolean {
  return navigationRef.isReady() && useAppStore.getState().authenticated;
}

function doNavigate(target: NotificationTarget): void {
  // All targets are tab routes nested under the root "MainTabs" stack screen.
  // The typed `navigate` can't express a computed nested route, so go through
  // the loosely-typed signature — every target is a real MainTab route.
  (navigationRef.navigate as (name: string, params?: object) => void)("MainTabs", {
    screen: target.screen,
    params: target.params,
  });
}

export function navigateToNotificationTarget(target: NotificationTarget): void {
  if (canNavigate()) doNavigate(target);
  else pendingTarget = target; // replayed by flushPendingNotificationTarget
}

/** Called once the navigator + auth are ready (see `usePushNotifications`). */
export function flushPendingNotificationTarget(): void {
  if (!pendingTarget || !canNavigate()) return;
  const target = pendingTarget;
  pendingTarget = null;
  doNavigate(target);
}

/** Routes a tapped notification (foreground/background/cold-start alike). */
export function handleNotificationResponse(
  response: Notifications.NotificationResponse,
): void {
  const content = response.notification.request.content;
  const data = content.data as { link?: string; type?: string } | undefined;
  const target = resolveNotificationRoute(data?.link, data?.type, content.title);
  navigateToNotificationTarget(target);
}
