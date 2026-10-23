// Native Sign in with Apple. Required by App Store Guideline 4.8 for any app
// that offers a third-party social login — Safarly offers Google, so Apple has
// to sit beside it on iOS.
//
// Like `googleOAuth.ts`, the native module is loaded lazily: a top-level import
// throws at module evaluation in builds whose binary lacks `ExpoAppleAuthentication`
// (Expo Go, or any Android build), which would take the whole app down at boot.

import type * as AppleAuthenticationModule from "expo-apple-authentication";
import * as Crypto from "expo-crypto";
import { Platform } from "react-native";

import { authApi } from "@/services/api/auth";
import { usersApi } from "@/services/api/users";

import { makeAppleNonce } from "./appleNonce";
import { AuthCancelledError, mapOAuthError } from "./oauthErrors";

export { AuthCancelledError } from "./oauthErrors";

type AppleAuthNative = typeof AppleAuthenticationModule;

let nativeModule: AppleAuthNative | null = null;

function isNativeModuleMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ExpoAppleAuthentication") ||
    /native module .* could not be found/i.test(msg) ||
    msg.includes("requireNativeModule")
  );
}

function nativeUnavailableError(): Error {
  return new Error(
    "Sign in with Apple needs the installed app or a development build — it " +
      "can't run inside Expo Go.",
  );
}

function loadNativeModule(): AppleAuthNative {
  if (nativeModule) return nativeModule;
  try {
    nativeModule = require("expo-apple-authentication") as AppleAuthNative;
    return nativeModule;
  } catch (err) {
    if (isNativeModuleMissing(err)) throw nativeUnavailableError();
    throw err;
  }
}

/**
 * Whether to show the Apple button at all.
 *
 * Apple only exists on iOS 13+, and `isAvailableAsync` is the supported check.
 * Everything here is defensive because this runs during first paint of the
 * welcome screen: any throw would blank the only route into the app.
 */
export async function isAppleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false;
  try {
    const AppleAuthentication = loadNativeModule();
    return await AppleAuthentication.isAvailableAsync();
  } catch {
    return false;
  }
}

/**
 * Apple returns the user's real name **only on the very first authorization**
 * for a given Apple ID + app pair. Every later sign-in — including after a
 * reinstall — returns null for it. So when it does arrive, write it through to
 * the profile immediately; there is no second chance to ask Apple for it.
 *
 * Failing to save the name must not fail the sign-in: the user is already
 * authenticated by that point, and they can still edit their profile by hand.
 */
async function persistAppleFullName(
  fullName: AppleAuthenticationModule.AppleAuthenticationFullName | null,
  email: string | null,
): Promise<void> {
  const name = [fullName?.givenName, fullName?.familyName]
    .filter(Boolean)
    .join(" ")
    .trim();
  if (!name) return;

  try {
    const { data } = await usersApi.getMyProfile();
    // Never clobber a name the user already has — this only fills the
    // placeholder a fresh Apple account arrives with.
    if (!isPlaceholderName(data?.profile?.name, email)) return;
    await usersApi.updateMyProfile({ name });
  } catch {
    // Non-fatal by design; see above.
  }
}

/**
 * Whether a profile name is the placeholder the `handle_new_user` trigger
 * writes, not one the user chose. Apple's ID token carries no name, so the
 * trigger falls back to the email's local part (for a private-relay address,
 * something like `x7k2pq9abc`) — treat that, or a blank, as "not set".
 */
export function isPlaceholderName(current: string | null | undefined, email: string | null): boolean {
  const name = current?.trim() ?? "";
  if (!name) return true;
  const localPart = email?.split("@")[0]?.trim() ?? "";
  return !!localPart && name.toLowerCase() === localPart.toLowerCase();
}

/**
 * Run the native Sign in with Apple handshake. Apple returns an identity token
 * which Supabase verifies via `signInWithIdToken`; success persists the session
 * and fires `onAuthStateChange`, which `AuthProvider` already listens to.
 * Throws `AuthCancelledError` when the user dismisses the sheet.
 */
export async function performAppleOAuth(): Promise<void> {
  const AppleAuthentication = loadNativeModule();

  // A fresh nonce per attempt: its hash goes to Apple (baked into the identity
  // token), the raw value to Supabase, which must match — see appleNonce.ts.
  const nonce = await makeAppleNonce({
    randomBytes: (n) => Crypto.getRandomBytes(n),
    sha256Hex: (v) => Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, v, { encoding: Crypto.CryptoEncoding.HEX }),
  });

  let credential: AppleAuthenticationModule.AppleAuthenticationCredential;
  try {
    credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: nonce.hashed,
    });
  } catch (err) {
    // Apple reports a user-dismissed sheet as ERR_REQUEST_CANCELED.
    const code = (err as { code?: string })?.code;
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
      throw new AuthCancelledError();
    }
    if (isNativeModuleMissing(err)) throw nativeUnavailableError();
    throw err;
  }

  if (!credential.identityToken) {
    throw new Error("Apple did not return an identity token. Please try again.");
  }

  let sessionEmail: string | null = null;
  try {
    const data = await authApi.appleSignInWithIdToken(credential.identityToken, nonce.raw);
    sessionEmail = data.user?.email ?? null;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(mapOAuthError(message, null, "Apple"));
  }

  await persistAppleFullName(credential.fullName ?? null, sessionEmail ?? credential.email ?? null);

  // Let the server keep Apple's refresh token, so account deletion can revoke
  // it from any platform (Guideline 5.1.1(v)). Best-effort and never awaited
  // by sign-in: a failure here must not affect signing in.
  if (credential.authorizationCode) {
    void usersApi.storeAppleToken(credential.authorizationCode).catch(() => {});
  }
}

/**
 * A fresh Sign in with Apple authorization code, for revoking Apple's tokens
 * when the account is deleted. Apple requires that revocation, and only a code
 * minted moments before can be exchanged for the token that gets revoked — so
 * the user confirms with Apple as the last step of deletion.
 *
 * Returns null where Apple sign-in is unavailable (Android, or an iOS build
 * without the native module), so deletion still proceeds there. Throws
 * `AuthCancelledError` if the user dismisses the Apple sheet.
 */
export async function requestAppleAuthorizationCode(): Promise<string | null> {
  if (!(await isAppleSignInAvailable())) return null;
  const AppleAuthentication = loadNativeModule();
  try {
    const credential = await AppleAuthentication.signInAsync({ requestedScopes: [] });
    return credential.authorizationCode ?? null;
  } catch (err) {
    const code = (err as { code?: string })?.code;
    if (code === "ERR_REQUEST_CANCELED" || code === "ERR_CANCELED") {
      throw new AuthCancelledError();
    }
    throw err;
  }
}
