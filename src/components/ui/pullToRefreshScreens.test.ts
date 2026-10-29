import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Every screen that shows server state the user waits on can be pulled to
 * refresh (29 Oct 2026 manual test): the ID-check status changes when an admin
 * approves it, and the pay screen's booking/KYC state changes server-side.
 * Forms (sign in, create listing, file dispute...) deliberately have none.
 */
const SCREENS = [
  "features/profile/KycVerificationScreen.tsx",
  "features/bookings/PayBookingScreen.tsx",
  "features/tabs/HomeScreen.tsx",
  "features/bookings/BookingsScreen.tsx",
  "features/travels/MyTravelsScreen.tsx",
  "features/messages/MessagesScreen.tsx",
  "features/tabs/NotificationsScreen.tsx",
  "features/search/SearchScreen.tsx",
  "features/disputes/DisputesScreen.tsx",
  "features/wallet/TransactionsScreen.tsx",
];

for (const rel of SCREENS) {
  test(`${rel} can be pulled to refresh`, () => {
    const src = readFileSync(new URL(`../../${rel}`, import.meta.url), "utf8");
    assert.match(src, /onRefresh|RefreshControl/);
  });
}
