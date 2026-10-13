# Safarly Mobile

This repo is the iOS and Android app for **Safarly**, a peer-to-peer parcel delivery
marketplace (main route US ↔ India). Travellers carry parcels for senders on the
same route, the price is agreed in chat, and payment is held in escrow until
delivery. The app also includes the **Travel Buddy** module.

**One codebase builds both platforms.** The iOS and Android apps come from the same Expo /
React Native source. Native Android configuration is committed in `android/`. iOS
is generated at build time from `app.json` / `app.config.js` (no `ios/` directory).

The backend (Supabase Postgres + Deno edge functions) and the web app live in the
**web repo** (`safarly-travel-hub`, checked out locally as `web app/safarly_web`).
Its `README.md` and `docs/ARCHITECTURE.md` describe the API, the deal state
machine, payments and auth. This app calls the same endpoints as the web app.
See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the mobile side.

---

## Stack

| | |
|---|---|
| Runtime | Expo SDK 54, React Native 0.81 (**New Architecture** on: `newArchEnabled=true`, edge-to-edge on Android), React 19.1, TypeScript 5.9 |
| Navigation | React Navigation 7: native stack + bottom tabs (`src/navigation/RootNavigator.tsx`), deep links in `linking.ts` |
| State | Zustand (`src/store/`) for app state. Data hooks in `src/hooks/api/` are plain React hooks over the API client, kept fresh through a realtime bus. |
| Backend | `@supabase/supabase-js` for auth, realtime and storage. Business calls go to the edge functions over HTTPS (`src/services/api/*`). |
| Auth | Email + password, Google (`@react-native-google-signin`), Sign in with Apple (`expo-apple-authentication`, iOS) |
| Push | `expo-notifications` → Expo push service → APNs / FCM. See [docs/PUSH_NOTIFICATIONS.md](docs/PUSH_NOTIFICATIONS.md). |
| Animation / gestures | Reanimated 4, Gesture Handler |
| Path alias | `@/` → `src/` (babel `module-resolver` + tsconfig) |

## Folder layout

```
App.tsx                   providers (SafeArea, AppFeedback, Auth), force-update gate, navigator
app.json / app.config.js  Expo config (app.config.js layers env-dependent values over app.json)
eas.json                  EAS build/submit profiles
android/                  committed native Android project (EAS builds it as-is)
src/
  features/<area>/        screens + feature logic, one folder per area:
                          auth, onboarding, tabs (Home/Notifications/Profile), search, parcels,
                          trips, travels (My Travels), bookings, messages (chat + inbox), buddies,
                          wallet, disputes, reviews, profile, moderation, opportunities,
                          activity, legal, splash
  components/             shared UI: ui/ (primitives: AppButton, AppInput, AppPressable, Screen,
                          KeyboardAwareSheet, KeyboardLift, CalendarModal, SearchablePickerSheet, ...),
                          chat/ (deal modals), moderation/, reviews/, reminders/, auth/, brand/, kyc/
  hooks/                  api/ (data hooks), realtime/, notifications/, plus useKeyboardMetrics,
                          useModalHandoff, useVersionGate, usePendingDeepLink, ...
  services/api/           one client per edge function (client.ts builds auth headers)
  services/auth/          Google / Apple OAuth (+ .web.ts stubs), auth error mapping
  services/notifications/ push registration + notification → route mapping
  navigation/             RootNavigator, linking, navigationRef, route types
  context/                AuthContext, AppFeedbackContext (toasts + app alert)
  feedback/               showToast / showAppAlert, callable outside React
  integrations/supabase/  supabase client, env resolution, authFetch
  lib/                    imagePicker options, app version / build info, user-facing error scrubber
  utils/                  money, dates (date-only parsing), route matching, sanitizers, ...
  store/                  Zustand stores, realtime bus
  theme/, i18n/, constants/, types/, data/, assets/
scripts/                  start-env, guard scripts, EAS hook
docs/                     PUSH_NOTIFICATIONS.md, ARCHITECTURE.md
```

## Environments

| | Production | Staging (`Safarly Staging`) |
|---|---|---|
| Supabase project ref | `rbtdkdbmtecungdthujf` | `gnnqcqvigynkoyrxdwkg` |
| Env file | `.env` | `.env.staging` |
| Start | `npm start` / `npm run dev` | `npm run start:staging` / `npm run dev:staging` |

`scripts/start-env.mjs` loads the chosen file and starts Expo with those
variables (Expo itself only understands `.env`). It **refuses to start** if
`.env.staging` points at the production ref. Anything after `--` is forwarded
to Expo: `npm run start:staging -- --android`.

`src/integrations/supabase/env.ts` **throws** when the Supabase variables are missing.
There is no hardcoded fallback project. Copy `.env.example` to `.env`. Its comment
saying `env.ts` "ships working dev fallbacks" is out of date.

Variables (`EXPO_PUBLIC_*` gets inlined into the bundle, so it must hold public values only):

| Variable | Purpose |
|---|---|
| `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Supabase project (required) |
| `EXPO_PUBLIC_ENV` | `staging` marks a staging build (`IS_STAGING`) |
| `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` | Google sign-in audience (the Web OAuth client configured in Supabase) |
| `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID`, `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME` | Google sign-in on iOS. Without the URL scheme, `app.config.js` drops the plugin and iOS hides the Google button. |
| `EAS_PROJECT_ID` (build-time, optional) | Overrides `extra.eas.projectId` |
| `GOOGLE_SERVICES_JSON` (EAS file variable) | Supplies the gitignored `google-services.json` on EAS builders (`scripts/eas-google-services.mjs`) |

Never put the Google client secret or a Supabase service key in this repo.

## Local development

Prerequisites: Node 24 (CI uses 24; `npm test` relies on Node's built-in TypeScript
stripping), npm, and Android Studio / an emulator for Android. Building iOS locally needs
a Mac with Xcode. Otherwise use EAS.

```bash
npm ci
cp .env.example .env         # fill in the EXPO_PUBLIC_* values
npm start                    # Expo dev server against .env (production)
npm run start:staging        # ... against .env.staging
npm run android              # expo run:android: native debug build on a device/emulator
npm run ios                  # expo run:ios: macOS + Xcode only
```

Push notifications do **not** work in Expo Go on SDK 54. Use a development build.

## npm scripts

| Script | What it does |
|---|---|
| `start`, `dev` | `start-env.mjs production`: Expo with `.env` |
| `start:staging`, `dev:staging` | `start-env.mjs staging`: Expo with `.env.staging` |
| `android` / `ios` | `expo run:android` / `expo run:ios` (local native build) |
| `web` | `expo start --web` (react-native-web, used for quick UI checks only) |
| `typecheck` | `tsc --noEmit` |
| `lint` | ESLint |
| `test` | Node's built-in test runner over `src/**/*.test.ts` |
| `check:errors` | Technical error text must never reach a user, and the scrubber must match the web copy |
| `check:ux` | Pins client-reported copy and layout fixes (shared file with the web repo) |
| `check:tests` | Fails if any test file is untracked in git |
| `eas-build-post-install` | EAS hook that copies `google-services.json` into place |

CI (`.github/workflows/ci.yml`, every push and every PR) runs: `npm ci` → typecheck →
`check:errors` → `check:ux` → lint → `check:tests` → `npm test`.

## Builds and releases (EAS)

`eas` is installed globally, and the Expo account login (owner `mysafarly`) belongs to the maintainer.

```bash
eas build -p ios --profile production       # store build (m-medium resource class)
eas build -p android --profile production   # .aab (app-bundle)
eas submit -p ios --profile production      # App Store Connect, ascAppId 6821827095
```

`eas.json` profiles:

- `development`: dev client, internal distribution, Android APK, iOS simulator
- `preview`: internal APK
- `production`: store distribution, `autoIncrement: true`

`cli.appVersionSource` is `remote`, so EAS keeps the **build numbers** (iOS
`buildNumber`, Android `versionCode`) and increments them itself.

### The committed `android/` directory

`android/` is checked in, and **EAS uses it as-is**. It does not regenerate it from
`app.json`. So:

- Native Android configuration (manifest, Gradle, signing, permissions) lives in
  `android/`. Changing `android.*` in `app.json` does **not** change an Android build.
- `app.json` drives **iOS** (prebuilt on EAS) and the **runtime** values the JS reads
  (`Constants.expoConfig`).
- **The version string lives in two places, and both must change together**: `expo.version` in
  `app.json` (what the force-update gate compares) and `versionName` in
  `android/app/build.gradle` (what Google Play shows and what EAS builds).
  `src/lib/versionSources.test.ts` fails if they disagree.
- Release signing reads `SAFARLY_UPLOAD_STORE_FILE`, `SAFARLY_UPLOAD_STORE_PASSWORD`,
  `SAFARLY_UPLOAD_KEY_ALIAS` and `SAFARLY_UPLOAD_KEY_PASSWORD` from
  `~/.gradle/gradle.properties` or the environment. Without them, a local release build silently
  falls back to the debug key. That build runs but can't be shipped. The keystore is never committed.

### Force-update gate

On launch, `useVersionGate` asks the backend's public `app-config` function for a
minimum version. A build below it shows `UpdateRequiredScreen`. Raising the floor is a
database change, not a release.

### iOS specifics

- Bundle id **`com.mysafarly.app`** (same id as the Android package). Phone only (`supportsTablet: false`).
  Universal links come from `associatedDomains` for `mysafarly.com` / `app.mysafarly.com`.
- **Sign in with Apple** (`usesAppleSignIn: true`, `src/services/auth/appleOAuth.ts`,
  `AppleSignInButton`). It's only offered where `isAvailableAsync()` is true (iOS).
- **Push**: `expo-notifications` talks to APNs through the Expo push service. The APNs key is
  managed with `eas credentials`. `app.config.js` sets `aps-environment` to
  `production` for `EAS_BUILD_PROFILE=production` (or `APNS_MODE=production`).
- **Pods**: `expo-build-properties` adds `GoogleUtilities` and `RecaptchaInterop` with
  `modular_headers: true`, which Google Sign-In's Swift pods need.
- Camera and photo-library usage strings are set in `infoPlist` and the `expo-image-picker` plugin.
  Microphone is disabled.
- There is no `ios/` directory. iOS builds happen on EAS, or on a Mac with `expo run:ios`.

## Testing

```bash
npm run typecheck
npm run lint
npm test                 # node --test over src/**/*.test.ts
npm run check:errors && npm run check:ux && npm run check:tests
```

Unit tests cover pure logic: money and fee math, date-only parsing, offer
resolution, route matching, KYC validation, notification routing, version sources and so on.
There is no device/E2E suite in this repo. The Playwright E2E suite in the web repo
covers the shared backend. UI changes need checking on a real device or emulator
for **both** platforms (see below).

## Platform differences: how iOS and Android are handled

Most UI is shared. Where the platforms really behave differently, the
difference is handled once, in a shared component or hook. Use these and don't
reach for the raw native API:

| Concern | Use | Why |
|---|---|---|
| Alerts and confirmations | `showAppAlert` / `showToast` (`src/feedback/appFeedback.ts`), rendered by `src/context/AppFeedbackContext.tsx` | One custom, branded alert and toast that look the same on both platforms, instead of `Alert.alert` (the codebase has no `Alert.alert` calls). The alert closes before it runs its action, so an action that opens another surface waits for the dismissal on iOS. |
| Modal → next surface | `useModalHandoff` (`src/hooks/useModalHandoff.ts`) | UIKit presents one view controller at a time. Opening a Modal, alert or native picker while another Modal is still fading out is silently dropped on iPhone. On iOS the next step runs from the closing Modal's `onDismiss` (with a fallback timer). On Android it runs immediately. |
| Keyboard metrics | `useKeyboardMetrics` | The one place the keyboard is read. On iOS it uses the `will` events and the keyboard's `screenY`. On Android it adds the navigation bar back onto the reported height, because edge-to-edge surfaces run behind it. |
| Bottom sheets with inputs | `KeyboardAwareSheet` | A translucent edge-to-edge Modal is never resized for the keyboard on either platform, so `KeyboardAvoidingView` computes nothing. The sheet lifts itself by the keyboard's real reach and shrinks its max height to match. With the keyboard closed, it keeps the bottom safe-area clear. |
| Centred modals with inputs | `KeyboardLift` | On iOS it behaves like `KeyboardAvoidingView behavior="padding"`. On Android (RN 0.81 edge-to-edge Modals) it pads by the keyboard height from `useKeyboardMetrics`, so the card re-centres above the keyboard. |
| Screens | `Screen` (`src/components/ui/Screen.tsx`) | Wraps every screen in a `SafeAreaView` (top/left/right edges by default, configurable with `edges`) and a `KeyboardAvoidingView`. Screens whose ScrollView sets `automaticallyAdjustKeyboardInsets` pass `Platform.OS === "ios"` to skip the wrapper on iOS. Android ignores that prop and still needs the wrapper. |
| Dates | `CalendarModal` (`src/components/ui/`), `DatePicker` (`src/features/search/`) | Custom month-grid pickers in a Modal, instead of the native iOS/Android date pickers, so both platforms look and behave the same. Dates are built at local midnight to avoid UTC off-by-one errors. |
| Searchable lists (city, country) | `SearchablePickerSheet` (built on `KeyboardAwareSheet`); `ListPickerModal` for short lists | One searchable picker instead of the platform `Picker` / action sheets |
| Photo picking | `src/lib/imagePicker.ts` | Spread `LIBRARY_PICK_OPTIONS` into every library pick and call `requestLibraryPermission()` before it. On iOS it transcodes HEIC to JPEG (the server and web reject HEIC). On Android it skips the media-library permission request, because the system photo picker needs none. Asking for it broke every pick on Android 10–12. |
| Safe areas | `SafeAreaProvider` in `App.tsx` + `useSafeAreaInsets` | Notch, home indicator and Android navigation bar. The app runs edge-to-edge on Android. |
| Touch feedback | `AppPressable` (`src/components/ui/AppPressable.tsx`) | One pressed style (scale 0.97, opacity 0.85) on both platforms, plus a default `android_ripple` on Android |
| Remaining differences | `Platform.OS` checks (about 60, mostly in auth and form screens) | Small layout and behaviour tweaks. Prefer adding to the shared components above over adding new checks. |

## Keeping in step with the web app

Both clients render one product from one API, so when you fix something on one platform,
check the other. `src/lib/userFacingError.js`, `src/lib/errorFallback.js`,
`scripts/check-ux-copy.mjs` and `scripts/check-user-facing-errors.mjs` are
byte-identical with the web repo. When both repos are checked out side by side,
`check:errors` compares the scrubber copies. See the web repo's
`docs/ARCHITECTURE.md` § "Keeping web and mobile in sync".

## Engineering conventions

- Screens orchestrate UI. Domain logic goes in feature model/helper files (e.g.
  `features/parcels/model/`, `features/bookings/paymentMath.ts`).
- Import with the `@/` alias.
- Never send a price to pay. The server charges `bookings.agreed_amount`.
- Parse SQL `date` columns as local dates (see `src/utils/dateOnlyColumns.test.ts`).
- Show errors through the scrubber in `src/lib/userFacingError.js`, never a raw `error.message`.
- Commit every test file (`check:tests`).
