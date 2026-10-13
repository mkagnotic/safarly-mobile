/**
 * Where a Stripe return link lands when it has to START the app.
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
};

export function coldStartReturnLink(url: string | null): string | null {
  if (!url) return url;
  const match = /^safarly:\/\/([a-z-]+)(\/?(?:[?#].*)?)$/i.exec(url);
  const target = match ? COLD_START_TARGETS[match[1].toLowerCase()] : undefined;
  return target ? `safarly://${target}${match![2].replace(/^\//, "")}` : url;
}
