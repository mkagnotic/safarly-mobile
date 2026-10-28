/**
 * notify_canon (29 Oct 2026): popups, in-app notices and push - one rule set for
 * web, Android and iOS. Pure rules tested directly; screen wiring by source.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

import { heldPrompts, isPromptSuppressedRoute } from "../../components/reminders/autoPromptRules.ts";
import { freshMatchIds, matchPromptedKey, MATCH_PROMPT_COPY, nextPrompted } from "./matchPromptRules.ts";
import { resolveNotificationRoute } from "./notificationRoute.ts";
import { tappedNotificationIds } from "./notificationTap.ts";

const src = (p: string) => readFileSync(new URL(`../../../${p}`, import.meta.url), "utf8");
const UUID = "11111111-2222-3333-4444-555555555555";

describe("bug 1: one auto popup at a time, KYC welcome included", () => {
  test("whichever shows first holds the others; a tie goes to the earlier one", () => {
    assert.deepEqual(heldPrompts({}), { kycWelcome: false, reminder: false, rate: false });
    assert.deepEqual(heldPrompts({ rate: true }), { kycWelcome: true, reminder: true, rate: false });
    assert.deepEqual(heldPrompts({ reminder: true, rate: true }), { kycWelcome: true, reminder: false, rate: true });
    assert.deepEqual(heldPrompts({ kycWelcome: true, reminder: true }), { kycWelcome: false, reminder: true, rate: true });
  });
  test("the welcome lives in AutoPrompts, not on Home", () => {
    const auto = src("src/components/reminders/AutoPrompts.tsx");
    assert.match(auto, /variant="welcome"/);
    assert.match(auto, /heldPrompts\(/);
    const home = src("src/features/tabs/HomeScreen.tsx");
    assert.doesNotMatch(home, /variant="welcome"/);
    assert.doesNotMatch(home, /kycWelcomePending/);
  });
});

describe("bug 10: the same don't-interrupt screens as web, for every auto popup", () => {
  test("pay, rate, setup, payout setup, KYC, send parcel, list trip, create buddy", () => {
    for (const r of ["PayBookingTab", "DeliveryReviewTab", "ProfileSetup", "PayoutSetupTab", "KycVerification",
      "KycVerificationTab", "SendParcel", "SendParcelTab", "ListTrip", "ListTripTab", "CreateBuddyTab"]) {
      assert.equal(isPromptSuppressedRoute(r), true, r);
    }
    assert.equal(isPromptSuppressedRoute("Home"), false);
    assert.equal(isPromptSuppressedRoute(undefined), false);
  });
  test("the reminder waits too, and decides only when it can show", () => {
    const reminder = src("src/components/reminders/JourneyExpiryReminder.tsx");
    assert.match(reminder, /if \(decidedRef\.current \|\| loading \|\| held\) return;/);
    assert.match(reminder, /label="View in My Travels"/);
    assert.doesNotMatch(reminder, /View my travels/);
    assert.match(reminder, /styles\.itemTitle\} numberOfLines=\{2\}/);
    assert.match(src("src/components/reminders/AutoPrompts.tsx"), /held=\{reminderHeld \|\| suppressed\}/);
  });
});

describe("bug 3: opening a notice from a push or the banner marks it read", () => {
  test("picks the id, else unread notices with that link (and type)", () => {
    const list = [
      { id: "a", read: false, type: "booking", data: { link: "/customer/bookings/1" } },
      { id: "b", read: true, type: "booking", data: { link: "/customer/bookings/1" } },
      { id: "c", read: false, type: "payment", data: { link: "/customer/bookings/1" } },
    ];
    assert.deepEqual(tappedNotificationIds({ id: "z" }, list), ["z"]);
    assert.deepEqual(tappedNotificationIds({ link: "/customer/bookings/1" }, list), ["a", "c"]);
    assert.deepEqual(tappedNotificationIds({ link: "/customer/bookings/1", type: "booking" }, list), ["a"]);
    assert.deepEqual(tappedNotificationIds({}, list), []);
  });
  test("a push tap passes notification_id, and the badge refreshes after", () => {
    const push = src("src/services/notifications/push.ts");
    assert.match(push, /navigateToNotificationTarget\(target, \{ id: data\?\.notification_id, link: data\?\.link, type: data\?\.type \}\);/);
    assert.match(push, /bumpRealtimeTopic\("notifications"\);/);
    assert.match(push, /appActive: AppState\.currentState === "active",/);
  });
});

describe("bugs 5, 6, 7, 9, 14: links land where web lands", () => {
  test("Payout sent opens Payments", () => {
    assert.deepEqual(resolveNotificationRoute("/customer/profile/payments", "payment"), { screen: "TransactionsTab" });
  });
  test("/terms and /privacy open the legal pages (root stack)", () => {
    assert.deepEqual(resolveNotificationRoute("/terms", "system"), { screen: "TermsOfService", root: true });
    assert.deepEqual(resolveNotificationRoute("/privacy", null), { screen: "PrivacyPolicy", root: true });
  });
  test("bare /customer is Home, whatever the type", () => {
    assert.deepEqual(resolveNotificationRoute("/customer", "booking"), { screen: "Home" });
    assert.deepEqual(resolveNotificationRoute("/customer/", "booking"), { screen: "Home" });
    assert.equal(resolveNotificationRoute("/customer/bookings", "booking").screen, "BookingsTab");
  });
  test("/rate opens the rating page", () => {
    assert.deepEqual(resolveNotificationRoute(`/customer/bookings/${UUID}/rate`, "system"), {
      screen: "DeliveryReviewTab", params: { bookingId: UUID },
    });
  });
  test("only a message names the chat; other notices get the neutral placeholder", () => {
    const name = (type: string | null, title: string) =>
      (resolveNotificationRoute(`/customer/messages/${UUID}`, type, title).params as { name: string }).name;
    assert.equal(name("message", "Ravi"), "Ravi");
    assert.equal(name("buddy", "Match confirmed"), "Conversation");
    assert.equal(name("booking", "Parcel approved"), "Conversation");
    assert.equal(name(null, "Ravi sent a new offer"), "Conversation");
  });
});

describe("bug 12: route-match catch-up (web useMatchPrompt port)", () => {
  test("only unread match notices never told about; same per-user key as web", () => {
    const list = [
      { id: "m1", read: false, data: { kind: "route_match" } },
      { id: "m2", read: false, data: { kind: "route_match_summary" } },
      { id: "m3", read: true, data: { kind: "route_match" } },
      { id: "x", read: false, data: { kind: "journey_expiry" } },
    ];
    assert.deepEqual(freshMatchIds(list, new Set(["m2"])), ["m1"]);
    assert.equal(matchPromptedKey("u1"), "safarly:match-prompted:u1");
    assert.deepEqual(nextPrompted(["a"], ["a", "b"]), ["a", "b"]);
    assert.equal(MATCH_PROMPT_COPY.title, "🎯 You have new route matches");
    assert.equal(MATCH_PROMPT_COPY.message, "Someone matches your route and dates — tap to see them.");
  });
  test("the live banner remembers match ids so the catch-up never repeats them", () => {
    const rt = src("src/hooks/realtime/useRealtimeSync.ts");
    assert.match(rt, /if \(n\.id && isMatchNotice\(n\.data\)\) void rememberPrompted\(uid, \[n\.id\]\);/);
  });
});

describe("wording: same words as web", () => {
  test("clear all body; no success toasts on the list", () => {
    const list = src("src/features/tabs/NotificationsScreen.tsx");
    assert.match(list, /This removes every notification from your list\. It can't be undone\./);
    assert.doesNotMatch(list, /"All caught up"/);
    assert.doesNotMatch(list, /"Notifications cleared"/);
    for (const t of ["Couldn't mark as read", "Couldn't delete", "Couldn't clear", "Couldn't mark all as read", "Couldn't load notifications"]) {
      assert.ok(list.includes(t), t);
    }
  });
});
