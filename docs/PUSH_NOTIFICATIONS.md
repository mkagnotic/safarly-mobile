# Push Notifications — Complete Reference (Mobile)

The single source of truth for push notifications in the Safarly mobile app:
how it works, every file involved, the account/credential setup only a human can
do, how to test, and how to debug. Read top-to-bottom for a first setup; jump to
[Setup](#part-b--setup-what-only-you-can-do) if the code is already in place.

> **TL;DR** — All the **app code** is done and shipping-ready. Real delivery is
> blocked on three human-only steps: `eas init` (gives the app a `projectId`),
> uploading **FCM** credentials, and installing a **development build** on a real
> device. **Push does NOT work in Expo Go on SDK 54** — you must use a dev build.

---

## Part A — How it works (architecture)

```
 App launch ─► usePushNotifications() sets the foreground handler + tap listeners
 Login ──────► syncPushRegistrationOnLogin()  (silent, only if already permitted)
 Opt-in ─────► Preferences "Push Notifications" toggle → requestAndRegisterPushToken()
                  │  asks OS permission, mints Expo token
                  ▼
        POST /user-handler/me/push-token  { token, platform }
                  │
                  ▼   upsert into `push_tokens` (user_id, token, platform)
        ┌──────────────────────────────────────────────┐
        │ Backend event (message / offer / payment / …) │
        │ notifyUser() → sendPushNotification()          │
        │   • gates on user_preferences.push_enabled     │
        │   • reads push_tokens for the user             │
        │   • POST https://exp.host/--/api/v2/push/send  │
        └──────────────────────────────────────────────┘
                  │
                  ▼
        Expo push service → FCM (Android) / APNs (iOS) → device
                  │
   Tap ───────────┘  addNotificationResponseReceivedListener → resolveNotificationRoute → navigate
 Sign-out ─────► unregisterPushToken()  (DELETE, before the JWT is torn down)
```

**Key design points**
- **Opt-in is explicit.** Login never prompts; it only re-registers a token if
  permission was already granted. The Preferences toggle is where the OS prompt
  happens (web parity: web gates its toggle on the browser permission).
- **Delivery is gated server-side** on `user_preferences.push_enabled`. Turning
  the toggle off flips that flag → the backend stops sending, even if a token is
  still on file.
- **Taps route by `data.link`** (e.g. `/customer/messages/<uuid>` → chat), with a
  per-`type` fallback, shared with the in-app notification feed via one resolver.
- **Cold start is handled**: a tap that launches the app from a killed state is
  read via `getLastNotificationResponseAsync()` and queued until auth + the
  navigator are ready.

---

## Part B — Files involved (code map)

### Mobile app code (all committed / ready)
| File | Role |
|---|---|
| `src/services/notifications/push.ts` | Core service: permission request, token acquisition (`getExpoPushTokenAsync`), register/unregister, foreground handler, Android channel, tap→navigation bridge with cold-start queue. |
| `src/services/notifications/notificationRoute.ts` | `resolveNotificationRoute(link, type, title)` → target tab screen + params. Shared by the push-tap handler AND the in-app `NotificationsScreen`. |
| `src/hooks/notifications/usePushNotifications.ts` | Mounts the OS listeners + cold-start read + pending-flush. Mounted once in `RootNavigator`. |
| `src/navigation/navigationRef.ts` | App-wide navigation ref (lets non-React code navigate on tap). Attached to `NavigationContainer` in `App.tsx`. |
| `src/services/api/users.ts` | `registerPushToken` / `removePushToken` (→ `user-handler/me/push-token`); `UserPreferences.push_enabled`. |
| `src/features/profile/PreferencesScreen.tsx` | The "Push Notifications" toggle → `handlePushToggle` (permission + register on ON, deregister on OFF). |
| `src/context/AuthContext.tsx` | `syncPushRegistrationOnLogin()` on login; `unregisterPushToken()` in `signOut()`. |
| `src/navigation/RootNavigator.tsx` | Calls `usePushNotifications()`. |
| `App.tsx` | `<NavigationContainer ref={navigationRef}>`. |
| `app.json` | `expo-notifications` plugin (adds Android 13 `POST_NOTIFICATIONS` permission). Reads `projectId` from `expo.extra.eas.projectId`. |
| `eas.json` | Build profiles (`development` = internal APK w/ dev client). |

### Dependencies (installed)
`expo-notifications` · `expo-device` · `expo-constants` — SDK 54 compatible versions.

### Backend (already live in prod — no work needed)
| File | Role |
|---|---|
| `supabase/functions/_shared/push.ts` | `sendPushNotification` / `notifyUser` — gates on `push_enabled`, sends to Expo. |
| `supabase/functions/user-handler/index.ts` | `POST`/`DELETE me/push-token`; `PUT me/preferences` whitelist (`push_enabled`, `email_notifications`, …). |
| `push_tokens` table | `(user_id, token, platform)`, unique `(user_id, token)`. |
| `user_preferences.push_enabled` | Boolean gate, default `true`. |

---

## Part C — Setup (what only you can do)

Push cannot deliver until the app has a `projectId`, FCM credentials, and a real
build. Android first (free); iOS needs a paid Apple account.

### Step 1 — Create a free Expo account
Sign up at https://expo.dev (free tier is enough).

### Step 2 — Link the app to an EAS project (writes the projectId)
From `mobile app/safarly-mobile`:
```bash
npx eas-cli login          # your expo.dev credentials
npx eas-cli init           # creates the EAS project + writes expo.extra.eas.projectId into app.json
```
Afterwards `app.json` contains:
```json
"extra": { "eas": { "projectId": "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx" } }
```
That's the value the push code reads — no code change needed.

## Two Google Cloud projects — read before touching credentials

Safarly spans **two** Google Cloud projects, and the difference is invisible
until something fails:

| Project | Number | ID | Owns |
|---|---|---|---|
| Safarly | 733852567545 | `safarly-e0163` | **FCM push only** — everything on this page |
| My First Project | 1082460386256 | `eminent-quasar-496207-c0` | **OAuth** — Google Sign-In, web + Android |

`EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` starts `1082460386256-…`, so every Google
Sign-In credential belongs in **My First Project**. SHA-1 fingerprints added to
the Firebase project have no effect on sign-in whatsoever.

Two things that look like bugs and are not:

- **`google-services.json` has `"oauth_client": []`.** Correct. The app passes
  `webClientId` explicitly in `src/services/auth/googleOAuth.ts` and never reads
  that file for authentication. It is a push-credentials file.
- **No env var names the Android OAuth client.** By design — Google Play
  Services resolves it on the device from the app's package name and signing
  certificate. A wrong or missing one therefore fails *only* at sign-in, on a
  real install, with `DEVELOPER_ERROR` (code 10). It cannot be caught by any
  build, test or emulator run that doesn't exercise native Google Sign-In.

### Android OAuth clients required

Both with package **`com.mysafarly.app`**, in **My First Project**:

| Client | SHA-1 | Serves |
|---|---|---|
| `Safarly Android (Play)` | `19:D7:01:4D:B4:A5:D6:00:83:32:1F:09:53:E8:EB:FD:9F:1A:C7:8A` | Play Store installs |
| `Safarly Android (upload key)` | `6B:4D:69:72:A0:B7:3A:78:38:25:22:ED:0B:D9:F6:45:F3:AD:F6:F7` | Local and sideloaded APKs |

Play App Signing re-signs your AAB with Google's own key, so a store install
presents a **different** fingerprint from the APK you built. Both are needed.
Find the first under Play Console → *Test and release → App integrity →
Play app signing*; neither is a secret.

> **History.** On 2026-10-06 the first external tester could not sign in with
> Google. The only Android client was still registered to
> `com.anonymous.safarlymobile` — Expo's default package, renamed months
> earlier — with a stale fingerprint. Nothing in the app was wrong, no build
> had ever caught it, and an hour went into the Firebase project before anyone
> noticed the project numbers differed. Hence this section.

### Step 3 — Android push credentials (FCM V1)
1. Create a Firebase project at https://console.firebase.google.com (free).
2. Add an **Android app** with package name **`com.mysafarly.app`**
   (must match `app.json` → `android.package`).
3. Firebase → Project Settings → **Service accounts** → generate a new
   **private key** (JSON).
4. Upload it to Expo:
   ```bash
   npx eas-cli credentials
   # → Android → Push Notifications (FCM V1) → upload the service-account JSON
   ```

### Step 4 — Build & install a development build (Android)
```bash
npx eas-cli build --profile development --platform android
```
- Produces an internal **APK** with the dev client (see `eas.json`).
- Open the build link on your phone and install the APK.
- Run `npx expo start --dev-client` and open the app from the installed dev build
  (**not** Expo Go).

### Step 5 — iOS (later — needs a paid Apple Developer account, $99/yr)
```bash
npx eas-cli credentials    # → iOS → Push Notifications → let EAS create the APNs key
npx eas-cli build --profile development --platform ios
```
The app code already supports iOS; it's purely credentials + build.

---

## Part D — Testing

1. Sign in on the dev build.
2. **Profile → Preferences → Push Notifications** → toggle ON → accept the OS
   prompt. (This registers the device token.)
3. Trigger a notification from a second account (send a chat message, make an
   offer, etc.). You should receive a system push.
4. Tap it → the app opens the relevant screen (chat / wallet / bookings / …).
5. **Manual send** without app interaction: grab the device's
   `ExponentPushToken[...]` and use Expo's tester at
   https://expo.dev/notifications.
6. **Opt-out check:** toggle Push OFF, trigger an event → no push arrives
   (backend `push_enabled` gate).

---

## Part E — Optional but recommended

- **Backend `EXPO_ACCESS_TOKEN` secret** — `_shared/push.ts` adds an
  `Authorization: Bearer <EXPO_ACCESS_TOKEN>` header when set. Create a token at
  expo.dev → Account settings → Access tokens, then set a Supabase Edge Function
  secret `EXPO_ACCESS_TOKEN`. Push works without it (Expo allows unauthenticated
  sends), but authenticated is more robust.
- **Branded Android notification icon** — currently the default. For a custom
  small icon, add a **white, transparent PNG** (≈96×96) and reference it:
  ```json
  ["expo-notifications", { "icon": "./assets/notification-icon.png", "color": "#FF7A26" }]
  ```
  (Per project convention, supply the asset yourself — code just references it.)

---

## Part F — Troubleshooting

| Symptom | Cause / fix |
|---|---|
| Toggle ON does nothing / "Push isn't available yet" | No `projectId` (Step 2 not done) **or** running in **Expo Go** (use a dev build) **or** an emulator (needs a physical device). |
| "Notifications are blocked" toast | OS permission denied. Enable notifications for Safarly in device Settings (iOS won't re-prompt once denied). |
| Token registers but no push arrives | FCM credentials missing/wrong (Step 3), or `push_enabled=false`, or the Android `package` doesn't match the Firebase app. |
| Push arrives but tapping does nothing | Payload had no recognised `data.link` and no known `type` → lands on Home by design. Confirm the backend event sets `data.link`. |
| Works in dev build, not after store install | Production build needs the same FCM (Android) / APNs (iOS) credentials attached via `eas credentials`. |

---

## Part G — Known follow-ups (not blockers)

- Backend never prunes stale tokens (Expo receipts are ignored) — logged-out /
  reinstalled devices leave dead `push_tokens` rows. Harmless but they accumulate.
- A session lost **without** in-app sign-out (token expiry, remote sign-out)
  won't deregister the token; the `push_enabled` gate still applies and a dead
  token just no-ops on Expo's side.
