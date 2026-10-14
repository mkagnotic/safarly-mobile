import { getStateFromPath as defaultGetStateFromPath, type LinkingOptions } from "@react-navigation/native";
import { Linking } from "react-native";

import { resolveNotificationRoute } from "@/services/notifications/notificationRoute";
import { coldStartReturnLink } from "./returnLinks";
import type { RootStackParamList } from "./types";
import { stateForCustomerPath } from "./webLinks";

const PREFIXES = [
  "safarly://",
  "https://mysafarly.com/app",
  "https://app.mysafarly.com/app",
  // Whole-site prefixes, for the website pages the app claims (`/customer/…`,
  // see webLinks.ts). Listed after the `/app` ones; getStateFromPath below
  // handles a path either way.
  "https://mysafarly.com",
  "https://app.mysafarly.com",
];

/**
 * A cold-start URL, parked until the navigator can actually reach its target.
 *
 * `RootNavigator` renders its stacks conditionally, so at first mount only
 * Splash exists. React Navigation resolves `getInitialURL` exactly once, at
 * mount, and matches the result against that tree — so a link opened from a cold
 * start was matched before the destination existed and silently fell back to
 * Home. Warm links were always fine, because by then the real stack is mounted.
 *
 * Holding the promise open until the app settles does NOT work: React Navigation
 * renders nothing until `getInitialURL` resolves, so the splash screen never
 * mounts, never sets `splashDone`, and the app deadlocks on a blank screen until
 * the wait times out. So hand back `null` immediately and let `RootNavigator`
 * replay the link through `consumePendingDeepLink` once it is ready.
 */
let pendingUrl: string | null = null;

/** Returns the parked URL exactly once. */
export function consumePendingDeepLink(): string | null {
  const url = pendingUrl;
  pendingUrl = null;
  return url;
}

/**
 * Strips whichever configured prefix a URL carries, leaving the path that
 * `getStateFromPath` expects. Returns null for a URL we do not own.
 */
export function pathFromDeepLink(url: string): string | null {
  for (const prefix of PREFIXES) {
    if (!url.startsWith(prefix)) continue;
    const rest = url.slice(prefix.length);
    // Only at a path boundary: `https://mysafarly.com/apple` is not `/app`.
    if (!prefix.endsWith("://") && rest !== "" && !/^[/?#]/.test(rest)) continue;
    return rest.startsWith("/") ? rest : `/${rest}`;
  }
  return null;
}

/**
 * Path → navigation state, for both link families:
 *   - `/customer/…` website pages the app claims (webLinks.ts) open the screen
 *     push taps open for the same link. An unclaimed `/customer/…` page
 *     resolves to nothing, so the app stays where it is (Home on a cold start).
 *   - everything else is an app path, with an optional leading `/app`.
 * Never throws: an unknown path is "no state", never a crash.
 */
export function getStateFromPath(path: string, options?: Parameters<typeof defaultGetStateFromPath>[1]) {
  const p = path.startsWith("/") ? path : `/${path}`;
  if (/^\/customer(?:[/?#]|$)/.test(p)) {
    return stateForCustomerPath(p, resolveNotificationRoute) as ReturnType<typeof defaultGetStateFromPath>;
  }
  const appPath = p.replace(/^\/app(?=[/?#]|$)/, "") || "/";
  try {
    return defaultGetStateFromPath(appPath, options);
  } catch {
    return undefined;
  }
}

/**
 * Deep linking.
 *
 * The `safarly://` scheme was registered in the manifest long before anything
 * consumed it, so links opened the app and then dropped the path on the floor.
 * This is the config React Navigation needs to actually route them.
 *
 * Two prefix families:
 *   - `safarly://…`  — the custom scheme, used by our own emails and QR codes.
 *   - `https://mysafarly.com/app/…` — App Links / Universal Links, so a normal
 *     web URL opens the app when it is installed and the site when it is not.
 *     These only bypass the browser once the site serves the association files
 *     (`/.well-known/assetlinks.json` on Android, `/.well-known/apple-app-site-association`
 *     on iOS); until then they still resolve here through the chooser.
 *
 * Paths mirror the web app's own routes wherever one exists, so a single link in
 * an email works on both. `resolveNotificationRoute` stays the mapper for push
 * payloads — it deals in web `data.link` paths rather than app URLs, and the two
 * are deliberately kept separate.
 *
 * Auth: every screen under `MainTabs` requires a session. `RootNavigator` only
 * mounts that stack once signed in, so a link arriving while logged out settles
 * on the welcome screen instead of navigating — the user signs in and lands on
 * Home. Replaying the link after they sign in is deliberately not attempted
 * here; it needs somewhere durable to park the intent, and getting it half-right
 * strands people on a screen they cannot read.
 */
export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: PREFIXES,
  getStateFromPath,

  /**
   * Cold start. Park the URL and return null so the first render is never
   * blocked; `RootNavigator` replays it once the destination stack exists. Warm
   * links need none of this — by then the tree is mounted, so they go through
   * React Navigation's default `Linking` subscription untouched.
   */
  getInitialURL: async () => {
    pendingUrl = coldStartReturnLink(await Linking.getInitialURL());
    return null;
  },
  config: {
    screens: {
      // --- reachable while signed out ---
      Login: "login",
      Signup: "signup",
      ForgotPassword: "forgot-password",
      ResetPassword: "reset-password/:email",
      VerifyEmail: "verify-email/:email",
      TermsOfService: "terms",
      PrivacyPolicy: "privacy",
      About: "about",
      Contact: "contact",

      // --- signed in ---
      MainTabs: {
        screens: {
          Home: "home",
          Notifications: "notifications",
          MessagesTab: "messages",
          OfferChatTab: "messages/:conversationId",
          Parcels: "travels",
          Trips: "search",
          Profile: "profile",
          PublicProfileTab: "users/:userId",
          TripDetailsTab: "trips/:tripId",
          ParcelDetailsTab: "parcels/:parcelId",
          PartnerDetailsTab: "buddies/:listingId",
          BookingsTab: "bookings",
          DisputesTab: "disputes",
          TransactionsTab: "payments",
          PayoutSetupTab: "payout-setup",
          KycVerificationTab: "kyc",
          ReviewsTab: "reviews",
          SecurityTab: "settings/security",
          // Both stores require account deletion to be easy to find; a direct
          // link is what support points people at.
          DeleteAccountTab: "settings/delete-account",
          PreferencesTab: "settings/preferences",
          SettingsTab: "settings",
        },
      },
    },
  },
};
