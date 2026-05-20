/**
 * Google Sign-In client IDs.
 *
 * Native Google Sign-In hands the app a Google ID token, which Supabase
 * verifies via `signInWithIdToken`. For Supabase to accept it, the token's
 * audience must be the **Web** OAuth client ID configured on the Google
 * provider in the Supabase Dashboard — i.e. the *same* Web client ID the web
 * app already uses against the same project (`rbtdkdbmtecungdthujf`). So this
 * is **required on Android too** (Android signs the token, but its audience is
 * still the Web client).
 *
 * `GOOGLE_IOS_CLIENT_ID` is the separate iOS OAuth client. iOS sign-in is
 * deferred for now (Android-only) — leaving it empty is fine and changes
 * nothing for Android; wire it (plus the iOS URL scheme config plugin) when
 * iOS is picked up.
 *
 * Resolution mirrors `integrations/supabase/env.ts`: an `EXPO_PUBLIC_*` env
 * var (Expo inlines these at build time — these are public client IDs, not
 * secrets, so that is fine) with an empty fallback. Empty Web client ID is
 * intentional: it makes `configure()` fail loudly with an actionable message
 * instead of silently failing the handshake.
 *
 *   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID  -> "<n>-<hash>.apps.googleusercontent.com"  (required)
 *   EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID  -> "<n>-<hash>.apps.googleusercontent.com"  (iOS, later)
 */
export const GOOGLE_WEB_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ?? "";

export const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? "";
