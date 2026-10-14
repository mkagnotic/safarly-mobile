import assert from "node:assert/strict";
import fs from "node:fs";
import { test } from "node:test";

import { resolveNotificationRoute } from "../services/notifications/notificationRoute.ts";
import {
  CLAIMED_CUSTOMER_PATHS, isClaimedCustomerPath, stateForCustomerPath, targetForCustomerPath, webPathFromUrl,
} from "./webLinks.ts";

// Website links (emails keep normal https URLs) open the right app screen when
// the app is installed; everything else stays on the website.

const UUID = "3f0c5f7e-1a2b-4c3d-8e9f-0a1b2c3d4e5f";
const target = (path: string) => targetForCustomerPath(path, resolveNotificationRoute);

test("each emailed page opens its app screen", () => {
  const cases: Array<[string, string, Record<string, unknown>?]> = [
    [`/customer/messages/${UUID}`, "OfferChatTab", { conversationId: UUID }],
    [`/customer/bookings/${UUID}`, "BookingsTab", { expandId: UUID }],
    [`/customer/bookings/${UUID}/pay`, "PayBookingTab", { bookingId: UUID }],
    [`/customer/parcels/${UUID}`, "ParcelDetailsTab", { parcelId: UUID }],
    [`/customer/trips/${UUID}`, "TripDetailsTab", { tripId: UUID }],
    [`/customer/search?match=${UUID}&tab=buddy`, "Trips", { highlightId: UUID, tab: "buddy" }],
    ["/customer/my-trips?tab=partners", "Parcels", { tab: "partners" }],
    ["/customer/buddies", "Parcels", { tab: "partners" }],
    ["/customer/messages", "MessagesTab"],
    ["/customer/bookings", "BookingsTab"],
    ["/customer/disputes", "DisputesTab"],
    ["/customer/profile/kyc", "KycVerificationTab"],
    ["/customer/kyc", "KycVerificationTab"],
    ["/customer/payout-setup", "PayoutSetupTab"],
    ["/customer/profile/payout-setup", "PayoutSetupTab"],
    ["/customer/activity", "ActivityTab"],
    ["/customer/notifications", "Notifications"],
    ["/customer/profile/reviews", "ReviewsTab"],
  ];
  for (const [path, screen, params] of cases) {
    const t = target(path);
    assert.equal(t?.screen, screen, path);
    if (params) for (const [k, v] of Object.entries(params)) assert.equal(t?.params?.[k], v, `${path} ${k}`);
  }
});

test("pages without an app screen, admin, auth and legal pages are NOT claimed", () => {
  for (const path of [
    "/customer/profile/wallet", "/customer/profile/edit", "/customer/onboarding", "/customer/send-parcel",
    "/admin", "/admin/users", "/login/customer", "/signup", "/reset-password", "/privacy", "/terms",
    "/customer", "/customer-support", "/customer/messagesx",
  ]) {
    assert.equal(isClaimedCustomerPath(path), false, path);
    assert.equal(stateForCustomerPath(path, resolveNotificationRoute), undefined, path);
  }
});

test("a claimed link becomes signed-in navigation state on the right tab", () => {
  const state = stateForCustomerPath(`/customer/messages/${UUID}`, resolveNotificationRoute);
  assert.equal(state?.routes[0].name, "MainTabs");
  assert.equal(state?.routes[0].state.routes[0].name, "OfferChatTab");
});

test("only our https hosts count; look-alikes and other schemes do not", () => {
  assert.equal(webPathFromUrl(`https://mysafarly.com/customer/bookings/${UUID}`), `/customer/bookings/${UUID}`);
  assert.equal(webPathFromUrl("https://app.mysafarly.com/customer/search?match=x"), "/customer/search?match=x");
  assert.equal(webPathFromUrl("https://mysafarly.com.evil.com/customer/bookings"), null);
  assert.equal(webPathFromUrl("http://mysafarly.com/customer/bookings"), null);
  assert.equal(webPathFromUrl("not a url"), null);
});

test("the Android manifest and app.json claim exactly these pages, on both hosts", () => {
  const manifest = fs.readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
  const appJson = JSON.parse(fs.readFileSync("app.json", "utf8"));
  const filter = appJson.expo.android.intentFilters.find((f: { autoVerify?: boolean }) => f.autoVerify);
  for (const p of CLAIMED_CUSTOMER_PATHS) {
    for (const host of ["mysafarly.com", "app.mysafarly.com"]) {
      assert.ok(manifest.includes(`android:host="${host}" android:pathPrefix="${p}"`), `manifest misses ${host}${p}`);
      assert.ok(filter.data.some((d: { host: string; pathPrefix: string }) => d.host === host && d.pathPrefix === p), `app.json misses ${host}${p}`);
    }
  }
  const claimedInManifest = [...manifest.matchAll(/android:pathPrefix="(\/customer[^"]*)"/g)].map((m) => m[1]);
  for (const p of claimedInManifest) assert.ok((CLAIMED_CUSTOMER_PATHS as readonly string[]).includes(p), `manifest claims unlisted ${p}`);
});
