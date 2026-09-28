// Web stub. Metro resolves this in place of `appleOAuth.ts` for the web bundle
// so `expo-apple-authentication` — an iOS-only native module — is never imported
// there. Sign in with Apple is an App Store requirement, and Safarly ships it on
// iOS only; the web app keeps email and Google.

export { AuthCancelledError } from "./oauthErrors";

/** Never true on web, so the button is never rendered. */
export async function isAppleSignInAvailable(): Promise<boolean> {
  return false;
}

export async function performAppleOAuth(): Promise<void> {
  throw new Error("Sign in with Apple is only available in the iOS app.");
}

/** No Apple session to revoke on web. */
export async function requestAppleAuthorizationCode(): Promise<string | null> {
  return null;
}
