// Pure (no imports at all) so it runs under `node --test`. The route mapper is
// passed in: the app passes `resolveNotificationRoute` (linking.ts), as do tests.

/** Same shape as notificationRoute's `NotificationTarget`. */
export interface LinkTarget {
  screen: string;
  params?: Record<string, unknown>;
}
export type RouteResolver = (link: string, type: null) => LinkTarget;

/**
 * Website links that open the app when it is installed.
 *
 * Emails link to normal https pages (`https://mysafarly.com/customer/…`). With
 * the app installed, the pages that HAVE an app screen open in the app; every
 * other link, and every link for someone without the app, stays on the website.
 * This list is the single source of truth for which pages are claimed. The
 * website's `/.well-known/apple-app-site-association` and the Android manifest's
 * intent filters must claim exactly these, and `webLinks.test.ts` checks the
 * manifest against it.
 *
 * Deliberately NOT claimed (they stay on the website): /admin, sign-in, sign-up,
 * password reset, the legal pages, the wallet (removed from the app), and any
 * page without an app screen.
 *
 * Each claimed path is resolved by `resolveNotificationRoute`, the same mapper
 * push taps use, so an email and a push about the same booking open the same
 * screen.
 */
export const CLAIMED_CUSTOMER_PATHS = [
  "/customer/messages",
  "/customer/bookings",
  "/customer/parcels",
  "/customer/trips",
  "/customer/search",
  "/customer/my-trips",
  "/customer/buddies",
  "/customer/disputes",
  "/customer/notifications",
  "/customer/activity",
  "/customer/kyc",
  "/customer/payout-setup",
  "/customer/profile/kyc",
  "/customer/profile/payout-setup",
  "/customer/profile/reviews",
] as const;

const HOSTS = ["mysafarly.com", "app.mysafarly.com", "www.mysafarly.com"];

/** True when `path` is one of the claimed pages (the path itself or below it). */
export function isClaimedCustomerPath(path: string): boolean {
  const bare = path.split(/[?#]/)[0].replace(/\/+$/, "");
  return CLAIMED_CUSTOMER_PATHS.some((p) => bare === p || bare.startsWith(`${p}/`));
}

/**
 * The website path inside one of our https URLs (`/customer/…?…`), or null for
 * anything else: other hosts, other schemes, and look-alike paths. A prefix only
 * counts at a path boundary, so `https://mysafarly.com/apple` is NOT `/app`.
 */
export function webPathFromUrl(url: string): string | null {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return null;
  }
  if (u.protocol !== "https:" || !HOSTS.includes(u.hostname.toLowerCase())) return null;
  return `${u.pathname}${u.search}`;
}

/** The app screen for a claimed `/customer/…` path; null when not claimed. */
export function targetForCustomerPath(path: string, resolve: RouteResolver): LinkTarget | null {
  if (!isClaimedCustomerPath(path)) return null;
  return resolve(path, null);
}

/**
 * Navigation state for a claimed path: the signed-in tabs, opened on the target.
 * React Navigation's `getStateFromPath` shape.
 */
export function stateForCustomerPath(path: string, resolve: RouteResolver) {
  const target = targetForCustomerPath(path, resolve);
  if (!target) return undefined;
  return {
    routes: [{
      name: "MainTabs",
      state: { routes: [{ name: target.screen, params: target.params }] },
    }],
  };
}
