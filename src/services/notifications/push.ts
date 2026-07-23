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

/** Persists the last Expo token so we can deregister it on sign-out. */
const LAST_TOKEN_KEY = "safarly.pushToken";
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
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
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
  return Platform.OS !== "web" && Device.isDevice;
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
 * Silent: register a token on login ONLY if permission was already granted.
 * Never prompts — a returning user who previously opted in keeps working
 * without a surprise dialog; first-time opt-in happens via the Preferences
 * toggle. Best-effort; swallows all errors.
 */
export async function syncPushRegistrationOnLogin(): Promise<void> {
  try {
    if (!pushSupported()) return;
    const projectId = getProjectId();
    if (!projectId) return;
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== "granted") return; // do not prompt on login
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
  try {
    const token = await AsyncStorage.getItem(LAST_TOKEN_KEY);
    if (!token) return;
    await usersApi.removePushToken(token);
    await AsyncStorage.removeItem(LAST_TOKEN_KEY);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn("[push] unregisterPushToken failed", err);
  }
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
