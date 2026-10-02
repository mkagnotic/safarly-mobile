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
    return {
      screen: "OfferChatTab",
      params: {
        conversationId: messagesMatch[1],
        name: title?.replace(/^New message from /i, "") ?? "Conversation",
        source: "messages",
      },
    };
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
    const params: { highlightId?: string; tab?: "package" | "receiver" | "buddy" } = {};
    if (m) params.highlightId = m[1];
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
  if (l.includes("/wallet")) return { screen: "TransactionsTab" };
  if (l.includes("/kyc")) return { screen: "KycVerificationTab" };
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
