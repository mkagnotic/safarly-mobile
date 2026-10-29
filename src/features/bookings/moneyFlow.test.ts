/**
 * Money-flow canon (28 Oct 2026): what the app says about money follows what
 * the server did, and the pay / payout screens never loop, lie or name the
 * wrong processor. Pure rules are tested directly; screen wiring by source.
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { test } from "node:test";

import {
  cancelMoneyLine,
  cancelToast,
  declineCopy,
  declineToast,
  postPossessionResult,
  returnResolutionToast,
} from "./lib/moneyMessages.ts";
import { keyForSession } from "../../hooks/api/checkoutKey.ts";
import { receiptReference } from "../wallet/receiptReference.ts";

const src = (p: string) => readFileSync(p, "utf8");

// ── Pure rules ────────────────────────────────────────────────────────────────

test("cancel dialog money line: possession first, then paid, else nobody charged", () => {
  assert.equal(
    cancelMoneyLine({ handoff_accepted_at: "2026-10-28T00:00:00Z", payment_made: false }, true),
    "The parcel is already with the carrier, so it will need to come back. Nobody has been charged.",
  );
  assert.equal(cancelMoneyLine({ payment_made: true }, true), "You'll be refunded in full.");
  assert.equal(cancelMoneyLine({ payment_made: true }, false), "The sender will be refunded in full.");
  assert.equal(cancelMoneyLine({}, true), "Nobody has been charged.");
});

test("cancel toast follows the server's answer", () => {
  assert.equal(cancelToast({ status: "unpaid_return" }), "Delivery cancelled — the parcel needs to come back");
  assert.equal(cancelToast({ status: "cancelled", refunded: true }), "Booking cancelled — you've been refunded in full.");
  assert.equal(cancelToast({ status: "cancelled", refunded: false, refund_amount: 0 }), "Booking cancelled");
  assert.equal(cancelToast(null), "Booking cancelled");
});

test("post-possession cancel: penalty from next payout, waiver, refund only if paid", () => {
  const fmt = (n: number) => `$${n}`;
  assert.deepEqual(postPossessionResult({ penalty_amount: 5, refund_amount: 50, waiver_eligible: true }, fmt), {
    title: "Delivery cancelled",
    message: "$5 penalty will be taken from your next payout. A waiver request is open. The sender has been refunded in full.",
  });
  assert.deepEqual(postPossessionResult({ penalty_amount: 0, refund_amount: 0 }, fmt), {
    title: "Delivery cancelled",
    message: "No cash penalty. The sender hadn't paid yet, so they weren't charged.",
  });
});

test("decline dialog and toast depend on dispatch / where the parcel is", () => {
  assert.equal(declineCopy(true).title, "Decline this parcel at handoff");
  assert.equal(declineCopy(false).title, "Cancel this delivery before the parcel is sent");
  assert.match(declineCopy(false).body, /your trip changed, or you can't take the parcel after all/);
  assert.equal(declineToast(true), "Parcel declined — your sender will tell you where to send it back");
  assert.equal(declineToast(false), "Parcel declined — your sender has been notified");
});

test("'I already have the parcel' closes the delivery at once", () => {
  assert.equal(returnResolutionToast("sender_has_parcel"), "Thanks — this delivery is now closed");
  assert.equal(returnResolutionToast("return_to_sender"), "Saved — your carrier has been told what to do with the parcel");
});

test("idempotency key: one per checkout session, reused on retry", () => {
  let n = 0;
  const make = () => `k${++n}`;
  const a = keyForSession(null, "cs_1", make);
  assert.equal(keyForSession(a, "cs_1", make), a, "same session reuses the key");
  const b = keyForSession(a, "cs_2", make);
  assert.notEqual(b.key, a.key, "a new session never reuses the old key");
  assert.equal(keyForSession(null, "cs_1", make).key, "k3", "dropped key starts fresh");
});

test("receipt reference: refund id on refunds, provider-neutral ids first", () => {
  assert.deepEqual(
    receiptReference({ type: "refund", stripe_payment_intent_id: "pi_1", stripe_refund_id: "re_1" }),
    { label: "Refund reference", value: "re_1" },
  );
  assert.deepEqual(
    receiptReference({ type: "refund", provider_refund_id: "rfnd_R", stripe_refund_id: "re_1" }),
    { label: "Refund reference", value: "rfnd_R" },
  );
  assert.deepEqual(
    receiptReference({ type: "payment", provider_payment_id: "pay_R", reference: "x" }),
    { label: "Payment reference", value: "pay_R" },
  );
  assert.deepEqual(receiptReference({ type: "payment" }), { label: "Payment reference", value: "—" });
});

// ── Screen wiring (source checks) ─────────────────────────────────────────────

test("pay screen: error effect runs once per error, never depends on the kyc object", () => {
  const s = src("src/features/bookings/PayBookingScreen.tsx");
  assert.ok(s.includes("handledPayErrorRef.current === payError"));
  assert.ok(s.includes("}, [payError, kycRefetch, refetch]);"));
  assert.ok(!s.includes("}, [payError, kyc, refetch]);"));
});

test("pay screen: provider never defaults to Stripe; handoff-first success copy", () => {
  const s = src("src/features/bookings/PayBookingScreen.tsx");
  assert.ok(!s.includes('useState("Stripe")'));
  assert.ok(s.includes('export const PAYMENT_PARTNER = "our payment partner";'));
  assert.ok(s.includes("is held safely by Safarly and released to the carrier only after delivery"));
  assert.ok(s.includes('label="Go to my bookings"'));
  assert.ok(s.includes("Secured by {providerLabel} · Held by Safarly until delivery"));
  assert.ok(s.includes('"Confirming your payment…"'));
  assert.ok(s.includes("bookingStatusLabel(booking.status)"));
  assert.ok(!s.includes("held in escrow"));
});

test("checkout confirm is keyed per session", () => {
  const s = src("src/hooks/api/usePayBooking.ts");
  assert.ok(s.includes("keyForSession(idempotencyKeyRef.current, intent.session_id, newIdempotencyKey)"));
});

test("payout setup: country block, provider naming, refresh errors, return toasts, busy labels", () => {
  const s = src("src/features/wallet/PayoutSetupScreen.tsx");
  assert.ok(s.includes('title: "Payouts unavailable in your country"'));
  assert.ok(s.includes("{!hasAccount && !countryBlock ? ("), "benefits hidden when blocked");
  assert.ok(!s.includes('provider_label ?? "Stripe"'));
  assert.ok(s.includes("Couldn't refresh your payout status"));
  assert.ok(s.includes("Payouts connected — you're all set to accept deliveries."));
  assert.ok(s.includes('"Opening…"') && s.includes("`Redirecting to ${providerLabel}…`"));
  assert.ok(s.includes("if (!kycSettled ||"), "no setup UI until KYC has loaded");
  assert.ok(!src("src/features/auth/ProfileSetupScreen.tsx").includes('provider_label ?? "Stripe"'));
  const rz = src("src/features/wallet/RazorpayPayoutForm.tsx");
  assert.ok(!/sent straight to Razorpay and|Razorpay is verifying your account/.test(rz));
  assert.ok(rz.includes('"Saving…"'));
});

test("payout dialog no longer promises to bring the carrier straight back", () => {
  const s = src("src/components/chat/PayoutRequiredModal.tsx");
  assert.ok(!s.includes("come straight back"));
  assert.ok(s.includes("come back to this chat to finish accepting"));
  assert.ok(s.includes("once the sender confirms delivery"));
});

test("receipts: right reference, share fallback says so, rows locked", () => {
  const r = src("src/features/wallet/receiptPdf.ts");
  assert.ok(r.includes("receiptReference(tx)"));
  assert.ok(!r.includes("tx.stripe_payment_intent_id || tx.stripe_refund_id"));
  assert.ok(r.includes('return "copied";'));
  const t = src("src/features/wallet/TransactionsScreen.tsx");
  assert.ok(t.includes("Sharing isn't available on this device"));
  assert.ok(t.includes("Couldn't generate the receipt. Please try again."));
  assert.ok(t.includes("locked={downloadingId !== null}"));
  assert.ok(!src("src/features/wallet/transactionDisplay.ts").includes("Wallet top-up"));
});

test("handoff card: no escrow claim before payment", () => {
  const s = src("src/features/bookings/HandoffPlanCard.tsx");
  assert.ok(s.includes("You haven't paid anything yet — you pay after ${carrierName} accepts the parcel."));
  assert.ok(s.includes("You pay once they accept it."));
  assert.ok(!s.includes("safe in escrow") && !s.includes("stays in escrow"));
});

test("cancel / accept / waiver dialogs tell the truth about money", () => {
  const pp = src("src/features/bookings/components/CancelPostPossessionModal.tsx");
  assert.ok(!pp.includes("cash penalty is refunded"));
  assert.ok(pp.includes("If the sender agrees, the penalty is cancelled and won't be taken from your payouts. The strike still applies."));
  assert.ok(pp.includes("The parcel goes back: the sender chooses where, and you send it"));
  assert.ok(!pp.includes("the sender can waive the cash penalty."));
  const ac = src("src/features/bookings/components/AcceptHandoffModal.tsx");
  assert.ok(!ac.includes("time out or be cancelled"));
  assert.ok(ac.includes("Yes, I have it — accept"));
  assert.ok(src("src/features/bookings/components/ExpandedBookingModals.tsx").includes("cancelMoneyLine(booking, isSender)"));
  assert.ok(src("src/features/bookings/components/RejectHandoffModal.tsx").includes("declineCopy(parcelDispatched)"));
});

test("actions: list refreshes, no code banner, delay form clears only on success", () => {
  assert.ok(src("src/features/bookings/hooks/useExpandedBooking.ts").includes('bumpRealtimeTopic("bookings");'));
  const a = src("src/features/bookings/lib/bookingActions.ts");
  assert.ok(!a.includes('"Delivery code generated"'));
  assert.ok(a.includes("cancelToast(") && a.includes("declineToast(withCarrier)"));
  const j = src("src/features/bookings/JourneyActionsCard.tsx");
  assert.ok(/if \(!ok\) return;\s*setDelayOpen\(false\);/.test(j));
  assert.ok(j.includes('use "I can\'t complete this delivery".'));
  assert.ok(!src("src/features/bookings/components/DeliveryCodePanel.tsx").includes("It expires in 30 minutes"));
  assert.ok(src("src/features/bookings/components/ConfirmDeliveryStep.tsx").includes("Three wrong tries locks the code"));
});

test("mock wallet / fake-card pay screens are gone", () => {
  for (const f of ["ReviewPayScreen", "PaymentSuccessScreen", "PaymentFailureScreen"]) {
    assert.ok(!existsSync(`src/features/parcels/${f}.tsx`), `${f} should be deleted`);
  }
  assert.ok(!src("src/navigation/RootNavigator.tsx").includes("ReviewPay"));
});

test("user-facing hyphen dashes are em dashes in the money/handoff flow", () => {
  const files = [
    "src/features/bookings/lib/bookingActions.ts",
    "src/features/bookings/components/RejectHandoffModal.tsx",
    "src/features/bookings/components/AwaitingPaymentNotice.tsx",
    "src/features/bookings/ParcelReturnCard.tsx",
  ];
  for (const f of files) {
    // Only quoted strings and JSX text, not comments.
    const quoted = src(f).match(/"[^"\n]* - [^"\n]*"/g) ?? [];
    assert.deepEqual(quoted, [], `${f} still has " - " in a string`);
  }
});

// ── Bookings canon (28 Oct 2026): My Bookings + Delivery details ──────────────

test("bookings: progress bar hidden on a parcel going home (unpaid_return)", () => {
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes('"expired_unpaid", "disputed", "unpaid_return"].includes('));
});

test("bookings: a failed background refetch keeps the rows and says so", () => {
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes('showToast({ title: "Couldn\'t refresh your bookings"'));
  assert.ok(s.includes("if (!error || !hasRowsRef.current) return;"));
  // The full-screen error stays for the nothing-loaded case only.
  assert.ok(s.includes("if (error && bookings.length === 0) {"));
});

test("bookings: pull-to-refresh also refetches the open card; deep link re-opens per tap", () => {
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes("onRefresh={handleRefresh}"));
  assert.ok(s.includes("setRefreshKey((k) => k + 1);"));
  assert.ok(s.includes("if (expandedFor.current !== linkParams) {"));
});

test("bookings: search placeholder, (you) marker and the other party's rating", () => {
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes('placeholder="Search by city or booking ID…"'));
  assert.ok(!s.includes("Search by city, booking ID..."));
  assert.ok(s.includes('{role === "sender" ? " (you)" : ""}'));
  assert.ok(s.includes('{role === "carrier" ? " (you)" : ""}'));
  assert.ok(s.includes('role === "carrier" && ratingText(booking.sender.rating)'));
  assert.ok(s.includes('role === "sender" && ratingText(booking.carrier.rating)'));
});

test("bookings: empty state names the tab and both CTAs open Search", () => {
  const s = src("src/features/bookings/components/BookingsEmptyCard.tsx");
  for (const t of ["No bookings yet", "No active bookings", "No completed bookings", "No cancelled bookings"]) {
    assert.ok(s.includes(`"${t}"`), t);
  }
  assert.ok(s.includes('navigation.navigate("Trips", { tab: "receiver", browse: true })'));
  assert.ok(s.includes('navigation.navigate("Trips", { tab: "package", browse: true })'));
  assert.ok(s.includes(">Browse parcels</Text>") && s.includes(">Browse trips</Text>"));
  assert.ok(!s.includes('navigate("Parcels"'), "never the user's own listings");
  assert.ok(s.includes("{filterIdx === 0 ? ("), "CTAs only on All");
  const search = src("src/features/search/SearchScreen.tsx");
  assert.ok(search.includes("const isMatchDeepLink = !!(highlightId || forId || (requestedTab && !browseOnly));"));
});

test("bookings: delay notice only while the journey is ahead", () => {
  const s = src("src/features/bookings/components/SenderDelayNotice.tsx");
  assert.ok(s.includes('new Set(["payment_secured", "in_transit"])'));
  assert.ok(s.includes("!DELAY_NOTICE_STATUSES.has(booking.status)"));
  assert.ok(s.includes('` "${booking.delay_note}"`'));
  assert.ok(!s.includes('"completed"') && !s.includes('"refunded"'));
});

test("bookings: card details read Agreed price, a formatted category and an em dash", () => {
  const p = src("src/features/bookings/components/ParcelDetailsSection.tsx");
  assert.ok(p.includes(">Agreed price: </Text>") && !p.includes(">Fee: </Text>"));
  assert.ok(p.includes("{formatCategory(booking.parcel.category)}"));
  const t = src("src/features/bookings/components/BookingTimeline.tsx");
  assert.ok(t.includes("> — {e.description}</Text>") && !t.includes("> - {e.description}"));
});

test("delivery details: Receiver, real status tag, auth id, no raw error text", () => {
  const s = src("src/features/travels/DeliveryDetailsScreen.tsx");
  assert.ok(s.includes('const roleLabel = isSender ? "Carrier" : "Receiver";'));
  assert.ok(!s.includes('"Sender"'));
  assert.ok(s.includes("label={`Rate ${roleLabel.toLowerCase()}`}"));
  assert.ok(s.includes('booking.return_received_at ? "Returned - cancelled" : bookingStatusLabel(booking.status)'));
  assert.ok(!s.includes(">Delivered</Text>"));
  assert.ok(s.includes("const isSender = !!user?.id && booking.sender_id === user.id;"));
  assert.ok(!s.includes("useMyProfile"));
  assert.ok(s.includes('<ErrorState error={error} subject="this delivery" onRetry={() => void refetch()} />'));
  assert.ok(!s.includes("? getErrorMessage(error)"));
});

test("bookings: the open card says it is loading the timeline (web parity)", () => {
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes('<Text style={styles.updatingText}>Loading timeline…</Text>'));
  assert.ok(s.includes('testID="booking-timeline-loading"'));
});

test("bookings: search scope note, same words as web, only while more pages exist", () => {
  const d = src("src/features/bookings/lib/bookingDisplay.ts");
  assert.ok(d.includes('export const BOOKINGS_SEARCH_SCOPE_NOTE = "Searching loaded bookings only.";'));
  const s = src("src/features/bookings/BookingsScreen.tsx");
  assert.ok(s.includes("{search.trim() && hasMore ? ("));
  assert.ok(s.includes("{BOOKINGS_SEARCH_SCOPE_NOTE}"));
  assert.ok(!s.includes("Searching this page only."));
});
