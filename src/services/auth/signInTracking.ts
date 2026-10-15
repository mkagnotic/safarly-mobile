/**
 * App wiring for signInTrackingCore.ts (which holds the logic and is
 * unit-tested): the device id lives in the keystore, the event goes to the
 * server's POST /auth-handler/track.
 */
import * as SecureStore from "expo-secure-store";

import { authApi } from "@/services/api/auth";

import { createDeviceIdGetter, createSignInTracker } from "./signInTrackingCore";

const getDeviceId = createDeviceIdGetter({
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  // THIS_DEVICE_ONLY: a restored backup on a new phone must count as a new device.
  setItemAsync: (key, value) =>
    SecureStore.setItemAsync(key, value, { keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY }),
});

/** Fire-and-forget: `void trackSignIn(user.id, user.created_at)`. */
export const trackSignIn = createSignInTracker({
  getDeviceId,
  send: (deviceFp, eventType) => authApi.trackAuthEvent(deviceFp, eventType),
});
