/**
 * Where a Stripe (or Didit) return link lands when it has to START the app.
 *
 * Payout setup and checkout open Stripe in an in-app browser and wait for
 * `safarly://payout-return` / `safarly://pay-return`. While the app is alive,
 * `openAuthSessionAsync` catches that link and the waiting screen re-reads the
 * status itself - so those links deliberately have NO route: routing them would
 * pull a user out of signup's profile setup, or off the pay screen mid-confirm.
 *
 * But Android often kills a backgrounded app while the user is filling in
 * Stripe's forms (seen on a low-memory emulator, 14 Oct 2026). Then the link
 * cold-starts the app, nothing is waiting, and without this the user landed on
 * Home with no sign their setup or payment went through. On a cold start only,
 * send them to the screen that shows the result.
 */
const COLD_START_TARGETS: Record<string, string> = {
  "payout-return": "payout-setup",
  "pay-return": "bookings",
  // Identity verification (Didit) finishing after Android killed the app:
  // open the verification screen, which re-reads the result from the server.
  "kyc-return": "kyc",
};

export function coldStartReturnLink(url: string | null): string | null {
  if (!url) return url;
  const match = /^safarly:\/\/([a-z-]+)(\/?(?:[?#].*)?)$/i.exec(url);
  const source = match?.[1].toLowerCase();
  const target = source ? COLD_START_TARGETS[source] : undefined;
  if (!target) return url;
  const rest = match![2].replace(/^\//, "");
  // A checkout return names its booking (`booking_id`, set by the server's
  // /mobile-return URL). Bookings opens a booking from `expandId`, so pass it
  // on as that: otherwise the user landed on the list with nothing opened and
  // had to hunt for the booking they had just paid for (29 Oct 2026). The list
  // reads the booking from the server, so it shows the real paid/unpaid state.
  if (source === "pay-return") {
    const id = /[?&]booking_id=([0-9a-f-]{36})(?:[&#]|$)/i.exec(rest)?.[1];
    if (id && !/[?&]expandId=/.test(rest)) {
      return `safarly://${target}${rest}${rest.includes("?") ? "&" : "?"}expandId=${id}`;
    }
  }
  return `safarly://${target}${rest}`;
}
