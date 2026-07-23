import { useEffect } from "react";
import * as Notifications from "expo-notifications";

import {
  configureNotifications,
  flushPendingNotificationTarget,
  handleNotificationResponse,
} from "@/services/notifications/push";
import { useAppStore } from "@/store/useAppStore";

/**
 * Wires OS push notifications into navigation. Mount ONCE, inside the
 * NavigationContainer (so `navigationRef` is live) — see `RootNavigator`.
 *
 * Responsibilities:
 *   1. Configure the foreground presentation handler.
 *   2. Route taps (`addNotificationResponseReceivedListener`) to the right
 *      screen via `handleNotificationResponse`.
 *   3. Handle cold starts — a tap that launched the app from a killed state
 *      (`getLastNotificationResponseAsync`).
 *   4. Flush any target that arrived before auth/nav were ready, once the user
 *      becomes authenticated.
 *
 * Registration of the device token happens elsewhere (login sync in
 * `AuthContext`, explicit opt-in on `PreferencesScreen`) — this hook is purely
 * the receive/route side.
 */
export function usePushNotifications(): void {
  const authenticated = useAppStore((s) => s.authenticated);

  useEffect(() => {
    configureNotifications();

    const sub = Notifications.addNotificationResponseReceivedListener(
      handleNotificationResponse,
    );

    // Cold start: opened by tapping a push while the app was killed. The target
    // gets queued (auth/nav not ready yet) and replayed by the effect below.
    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationResponse(response);
    });

    return () => sub.remove();
  }, []);

  // Once authenticated (and MainTabs has had a beat to mount), replay any tap
  // captured before we could navigate.
  useEffect(() => {
    if (!authenticated) return;
    const id = setTimeout(() => flushPendingNotificationTarget(), 350);
    return () => clearTimeout(id);
  }, [authenticated]);
}
