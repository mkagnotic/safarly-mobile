import { MainTabParamList } from "@/navigation/types";

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
    return { screen: "Trips", params: m ? { highlightId: m[1] } : undefined };
  }
  if (l.startsWith("/customer/messages")) return { screen: "MessagesTab" };
  if (l.startsWith("/customer/bookings")) return { screen: "BookingsTab" };
  if (l.includes("/wallet")) return { screen: "WalletTab" };
  if (l.includes("/kyc")) return { screen: "KycVerificationTab" };
  if (l.startsWith("/customer/disputes")) return { screen: "DisputesTab" };
  if (l.startsWith("/customer/buddies")) return { screen: "Buddies" };
  if (l.startsWith("/customer/activity")) return { screen: "ActivityTab" };

  switch (type) {
    case "message":
      return { screen: "MessagesTab" };
    case "booking":
      return { screen: "BookingsTab" };
    case "payment":
      return { screen: "WalletTab" };
    case "kyc":
      return { screen: "KycVerificationTab" };
    case "dispute":
      return { screen: "DisputesTab" };
    case "buddy":
      return { screen: "Buddies" };
    case "rating":
      return { screen: "ActivityTab" };
    default:
      return { screen: "Home" };
  }
}
