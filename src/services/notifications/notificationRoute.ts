// Type-only: this module is pure and must stay importable without a bundler.
import type { MainTabParamList } from "@/navigation/types";

export interface NotificationTarget {
  screen: keyof MainTabParamList;
  params?: Record<string, unknown>;
}

/**
 * Maps a notification (its web-style `data.link`, `type`, and `title`) to the
 * native tab screen to open. Single source of truth shared by the in-app
 * notification feed (`NotificationsScreen`) and the OS push-tap handler
 * (`usePushNotifications`), so both route identically.
 *
 * Mirrors web's `resolveNotificationLink` + `fallbackPathForType`: prefer an
 * explicit `data.link`, else fall back to the type's home screen. A tap always
 * lands somewhere sensible rather than no-opping.
 *
 * Note: OS push payloads may omit `type` (the backend only guarantees `link` in
 * `data`), so link matching is the primary path; the `type` switch is the
 * best-effort fallback and lands on Home when neither is recognised.
 */
export function resolveNotificationRoute(
  link: string | undefined | null,
  type: string | undefined | null,
  title?: string | null,
): NotificationTarget {
  const l = link ?? "";

  const messagesMatch = l.match(/^\/customer\/messages\/([0-9a-f-]{36})/i);
  if (messagesMatch) {
    // `?deal=<carrier_request_id>` names the delivery the notice is about (e.g.
    // "trip details changed"). With several deals in one chat, dropping it opened
    // the server's default deal - the warning and the step were about another one.
    // Web reads the same param (`useThreadDeal` dealHint).
    const deal = l.match(/[?&]deal=([0-9a-f-]{36})(?:[&#]|$)/i);
    return {
      screen: "OfferChatTab",
      params: {
        conversationId: messagesMatch[1],
        name: title?.replace(/^New message from /i, "") ?? "Conversation",
        source: "messages",
        ...(deal ? { dealId: deal[1] } : {}),
      },
    };
  }

  // `/customer/bookings/:id/pay` — the "pay for your booking" nudge. Must run
  // BEFORE the generic bookings matcher below, which would swallow it and open
  // the list instead of checkout.
  const payMatch = l.match(/^\/customer\/bookings\/([0-9a-f-]{36})\/pay(?:[/?#]|$)/i);
  if (payMatch) {
    // `?status=success|cancelled` is the website's Stripe return, not a nudge.
    // iOS keeps that page on the web; Android app links can't exclude it, so a
    // web checkout can land here. Open the booking, never a second checkout.
    if (/[?&]status=(success|cancelled)(?:[&#]|$)/i.test(l)) {
      return { screen: "BookingsTab", params: { expandId: payMatch[1] } };
    }
    return { screen: "PayBookingTab", params: { bookingId: payMatch[1] } };
  }

  // Listing detail pages (web `/customer/parcels/:id`, `/customer/trips/:id`).
  const parcelMatch = l.match(/^\/customer\/parcels\/([0-9a-f-]{36})/i);
  if (parcelMatch) {
    return { screen: "ParcelDetailsTab", params: { parcelId: parcelMatch[1] } };
  }
  const tripMatch = l.match(/^\/customer\/trips\/([0-9a-f-]{36})/i);
  if (tripMatch) {
    return { screen: "TripDetailsTab", params: { tripId: tripMatch[1] } };
  }

  // `/customer/bookings/:id` isn't a route on web either — the list uses inline
  // expandable cards, so pass `expandId` to auto-open the row.
  const bookingsMatch = l.match(/^\/customer\/bookings\/([0-9a-f-]{36})/i);
  if (bookingsMatch) {
    return { screen: "BookingsTab", params: { expandId: bookingsMatch[1] } };
  }

  // Match-found notifications deep-link to search, optionally highlighting a
  // specific listing: `/customer/search?match=<uuid>`. "Trips" is the tab that
  // hosts the Search screen.
  if (l.startsWith("/customer/search")) {
    const m = l.match(/[?&]match=([0-9a-f-]{36})/i);
    // `tab` is what actually gets the user to the right list. The id alone only
    // works once that row has loaded, and the "N parcels match your trip" notices
    // carry no id at all — those used to land on the default Package tab.
    const t = l.match(/[?&]tab=(package|receiver|buddy)(?:&|$)/i);
    // `for` = the recipient's own listing; it scrolls a multi-match summary to
    // that listing's group instead of leaving the user at the top of the tab.
    const f = l.match(/[?&]for=([0-9a-f-]{36})(?:&|$)/i);
    const params: { highlightId?: string; tab?: "package" | "receiver" | "buddy"; forId?: string } = {};
    if (m) params.highlightId = m[1];
    if (f) params.forId = f[1];
    if (t) params.tab = t[1].toLowerCase() as "package" | "receiver" | "buddy";
    return { screen: "Trips", params: Object.keys(params).length ? params : undefined };
  }
  // Journey-expiry notices link here; "Parcels" is the tab hosting My Travels.
  // `?tab=` picks the list inside it — buddy notifications point at Travel
  // Partners, where a request is accepted and connected buddies live.
  if (l.startsWith("/customer/my-trips")) {
    const mt = l.match(/[?&]tab=(flights|packages|partners|archive)(?:&|$)/i);
    return mt
      ? { screen: "Parcels", params: { tab: mt[1].toLowerCase() } }
      : { screen: "Parcels" };
  }
  if (l.startsWith("/customer/messages")) return { screen: "MessagesTab" };
  if (l.startsWith("/customer/bookings")) return { screen: "BookingsTab" };
  // Carrier "set up payouts to accept this delivery" nudge links here.
  if (l.includes("/payout-setup")) return { screen: "PayoutSetupTab" };
  // Covers web's `/customer/profile/wallet` as well as older `/customer/wallet` links.
  if (l.includes("/wallet")) return { screen: "TransactionsTab" };
  if (l.includes("/kyc")) return { screen: "KycVerificationTab" };
  if (/^\/customer\/profile\/reviews(?:[/?#]|$)/.test(l)) return { screen: "ReviewsTab" };
  if (/^\/customer\/notifications(?:[/?#]|$)/.test(l)) return { screen: "Notifications" };
  // After the profile sub-pages above (wallet, kyc, payout-setup) so those keep
  // their own screens; anything else under the profile opens the Profile tab.
  if (/^\/customer\/profile(?:[/?#]|$)/.test(l)) return { screen: "Profile" };
  if (l.startsWith("/customer/disputes")) return { screen: "DisputesTab" };
  // ⚠️ NOT the "Buddies" tab — that route name is legacy and renders the INBOX
  // (see RootNavigator). Web's `/customer/buddies` is its create-a-listing form,
  // so neither end of this link led to the request it was announcing. Travel
  // Partners is where a buddy request is accepted.
  if (l.startsWith("/customer/buddies")) return { screen: "Parcels", params: { tab: "partners" } };
  if (l.startsWith("/customer/activity")) return { screen: "ActivityTab" };

  switch (type) {
    case "message":
      return { screen: "MessagesTab" };
    case "booking":
      return { screen: "BookingsTab" };
    case "payment":
      return { screen: "TransactionsTab" };
    case "kyc":
      return { screen: "KycVerificationTab" };
    case "dispute":
      return { screen: "DisputesTab" };
    case "buddy":
      return { screen: "Parcels", params: { tab: "partners" } };
    case "rating":
      return { screen: "ActivityTab" };
    default:
      return { screen: "Home" };
  }
}
