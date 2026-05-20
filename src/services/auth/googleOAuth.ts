// Native (iOS/Android) Google Sign-In via the OS account picker. Metro picks
// `googleOAuth.web.ts` for web, so the native package is never bundled there.
//
// The native module is loaded **lazily** so the JS bundle still boots in
// environments where the binary lacks `RNGoogleSignin` (Expo Go). A top-level
// import would throw `Invariant Violation: RNGoogleSignin could not be found`
// at module evaluation and take the whole app down.

import type * as GoogleSigninModule from "@react-native-google-signin/google-signin";

import { GOOGLE_IOS_CLIENT_ID, GOOGLE_WEB_CLIENT_ID } from "@/integrations/google/env";
import { authApi } from "@/services/api/auth";

import { AuthCancelledError, mapOAuthError } from "./oauthErrors";

export { AuthCancelledError } from "./oauthErrors";

type GoogleSigninNative = typeof GoogleSigninModule;

let nativeModule: GoogleSigninNative | null = null;

function isNativeModuleMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("RNGoogleSignin") ||
    msg.includes("RNGoogleSignIn") ||
    /native module .* could not be found/i.test(msg) ||
    msg.includes("requireNativeModule")
  );
}

function nativeUnavailableError(): Error {
  return new Error(
    "Google sign-in needs the installed app or a development build. Install " +
      "via `npx expo run:android`, or open the QR with the dev client " +
      "(`npx expo start --dev-client`) — it can't run inside Expo Go.",
  );
}

function loadNativeModule(): GoogleSigninNative {
  if (nativeModule) return nativeModule;
  try {
    nativeModule = require("@react-native-google-signin/google-signin") as GoogleSigninNative;
    return nativeModule;
  } catch (err) {
    if (isNativeModuleMissing(err)) throw nativeUnavailableError();
    throw err;
  }
}

let configured = false;

function ensureConfigured(GoogleSignin: GoogleSigninNative["GoogleSignin"]): void {
  if (configured) return;
  if (!GOOGLE_WEB_CLIENT_ID) {
    throw new Error(
      "Google sign-in is not configured. Set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID " +
        "to the Web OAuth client ID used by the Supabase Google provider.",
    );
  }
  // `webClientId` is the *Web* client ID — it is the audience (`aud`) of the
  // ID token Google mints. Android signs the request and Google resolves the
  // Android client from package + SHA-1; passing the Android client ID here
  // instead is the canonical cause of `DEVELOPER_ERROR`.
  GoogleSignin.configure({
    webClientId: GOOGLE_WEB_CLIENT_ID,
    iosClientId: GOOGLE_IOS_CLIENT_ID || undefined,
    scopes: ["openid", "email", "profile"],
  });
  configured = true;
}

/**
 * Run the native Google sign-in handshake. The Google SDK returns an ID token
 * which Supabase verifies via `signInWithIdToken`; success persists the
 * session and fires `onAuthStateChange`, which `AuthProvider` already
 * listens to. Throws `AuthCancelledError` on user dismissal.
 */
export async function performGoogleOAuth(): Promise<void> {
  const { GoogleSignin, isErrorWithCode, isSuccessResponse, statusCodes } =
    loadNativeModule();

  try {
    ensureConfigured(GoogleSignin);
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  } catch (err) {
    if (isNativeModuleMissing(err)) throw nativeUnavailableError();
    throw err;
  }

  let response;
  try {
    response = await GoogleSignin.signIn();
  } catch (err) {
    if (isErrorWithCode(err)) {
      if (err.code === statusCodes.SIGN_IN_CANCELLED) throw new AuthCancelledError();
      if (err.code === statusCodes.IN_PROGRESS) {
        throw new Error("A Google sign-in is already in progress.");
      }
      if (err.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        throw new Error("Google Play Services is not available or out of date.");
      }
    }
    if (isNativeModuleMissing(err)) throw nativeUnavailableError();
    throw err;
  }

  // v13+ returns a discriminated union rather than throwing on cancel.
  if (!isSuccessResponse(response)) {
    throw new AuthCancelledError();
  }

  const idToken = response.data.idToken;
  if (!idToken) {
    throw new Error("Google did not return an ID token. Please try again.");
  }

  try {
    await authApi.googleSignInWithIdToken(idToken);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(mapOAuthError(message, null));
  }
}
