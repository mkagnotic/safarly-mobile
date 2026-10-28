import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  DISPUTABLE_STATUSES,
  MAX_DESCRIPTION,
  descriptionCounter,
  disputeStatusLabel,
  eligibleDisputeBookings,
  evidenceSkipNote,
  DELIVERED_WINDOW_CLOSED_TEXT,
  DISPUTE_CLOSED_TEXT,
  bookingDisputeView,
  chipStatusLabel,
  deliveredWindowClosed,
  parcelHasOpenDispute,
  presetDisputeBooking,
  windowClosedBookings,
} from "./disputeRules.ts";
import {
  evidenceCountLabel,
  evidenceRoom,
  screenEvidence,
  skippedEvidenceMessage,
} from "./evidenceFiles.ts";

// 28 Oct 2026 dispute canon (mobile items). Same rules and words as web.

const src = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

test("status chips are labels, never the raw key", () => {
  assert.equal(disputeStatusLabel("open"), "Open");
  assert.equal(disputeStatusLabel("investigating"), "Under review");
  assert.equal(disputeStatusLabel("resolved"), "Resolved");
  assert.equal(disputeStatusLabel("something_new"), "Something new");
});

test("the stage set matches the server and web", () => {
  assert.deepEqual([...DISPUTABLE_STATUSES].sort(), [
    "awaiting_handoff", "cancelled_post_possession", "confirmed", "delivered",
    "handoff_rejected", "in_transit", "payment_secured", "unpaid_return",
  ]);
});

test("only bookings that can still take a dispute are offered", () => {
  const bookings = [
    { id: "a", status: "in_transit" },
    { id: "b", status: "pending_payment" },
    { id: "c", status: "disputed" },
    { id: "d", status: "cancelled_post_possession" }, // auto-opened dispute already
    { id: "e", status: "delivered" }, // dismissed earlier: has a dispute
    { id: "f", status: "cancelled" },
  ];
  assert.deepEqual(
    eligibleDisputeBookings(bookings, new Set(["e"])).map((b) => b.id),
    ["a"],
  );
});

test("the chat preselects the deal booking only when it can be disputed", () => {
  const eligible = [{ id: "a", status: "in_transit" }];
  assert.equal(presetDisputeBooking("a", eligible), "a");
  assert.equal(presetDisputeBooking("b", eligible), "");
  assert.equal(presetDisputeBooking(undefined, eligible), "");
});

test("the description counter appears near the 5,000 cap", () => {
  assert.equal(MAX_DESCRIPTION, 5000);
  assert.equal(descriptionCounter(100), null);
  assert.equal(descriptionCounter(4500), "4,500/5,000");
  assert.equal(descriptionCounter(5000), "5,000/5,000");
});

test("every evidence file left out is named", () => {
  assert.equal(evidenceSkipNote(null, []), null);
  assert.equal(
    evidenceSkipNote("Skipped: 1 over 10 MB.", [{ name: "a.png", message: "The file content didn't match its type." }]),
    "Skipped: 1 over 10 MB. a.png: The file content didn't match its type.",
  );
});

test("the file form drops HEIC and unknown files, with the reason", () => {
  const s = screenEvidence([
    { uri: "file:///x.heic", name: "x.heic", mimeType: "image/heic", size: 10 },
    { uri: "file:///y.bin", name: "y.bin", mimeType: null, size: 10 },
    { uri: "file:///z.jpg", name: "z.jpg", mimeType: "image/jpeg", size: 10 },
  ]);
  assert.equal(s.files.length, 1);
  assert.equal(skippedEvidenceMessage(s), "Skipped: 2 not a JPEG, PNG, WebP, GIF or PDF.");
});

test("the parcel banner keys off the booking", () => {
  assert.equal(parcelHasOpenDispute("p1", [{ id: "b", status: "disputed", parcel_id: "p1" }]), true);
  assert.equal(parcelHasOpenDispute("p1", [{ id: "b", status: "in_transit", parcel_id: "p1" }]), false);
  assert.equal(parcelHasOpenDispute("p1", [{ id: "b", status: "disputed", parcel_id: "p2" }]), false);
});

test("file form: screened picker, cap, wording", () => {
  const f = src("./FileDisputeScreen.tsx");
  assert.ok(f.includes("screenEvidence("), "file form screens evidence");
  assert.ok(!f.includes('"image/*"'), "no image/* (HEIC) in the picker");
  assert.ok(!f.includes('"application/octet-stream"'), "no unscreened files");
  assert.ok(f.includes("up.data?.skipped_files"), "server-skipped files are named");
  assert.ok(f.includes("maxLength={MAX_DESCRIPTION}"));
  assert.ok(f.includes("The Safarly support team will review it and reply in My Disputes."));
  assert.ok(!f.includes("reply here"));
  assert.ok(f.includes("Describe the problem and the Safarly support team will look into it."));
  assert.ok(f.includes('"File dispute"') && !f.includes("Submit Dispute"));
  assert.ok(f.includes("Loading your bookings…"));
});

test("disputes list: labels, outcome, waiver wording (pinned label kept)", () => {
  const d = src("./DisputesScreen.tsx");
  assert.ok(d.includes("disputeStatusLabel(dispute.status)"));
  assert.ok(!d.includes("{dispute.status}</Text>"));
  assert.ok(d.includes(">OUTCOME<") && !d.includes(">RESOLUTION<"));
  assert.ok(d.includes("Confirm return-eligibility waiver?"));
  assert.ok(d.includes("Only confirm if"));
  assert.ok(d.includes("The strike on their account stays."));
  assert.ok(d.includes("Confirm waiver — cancel penalty"));
});

test("chat Raise dispute always opens the form; no escalate call", () => {
  const m = src("../messages/chat/hooks/useChatActionMenu.ts");
  assert.ok(m.includes('navigation.navigate("FileDisputeTab", { bookingId: activeDeal?.booking_id ?? undefined })'));
  const api = src("../../services/api/disputes.ts");
  assert.ok(!api.includes("adminEscalate"));
  assert.ok(!api.includes("/escalate`"));
});

test("disputed booking card links to its dispute; parcel banner uses bookings", () => {
  const b = src("../bookings/BookingsScreen.tsx");
  assert.ok(b.includes("const disputeView = bookingDisputeView(booking);") && b.includes("{disputeView.link}"));
  const p = src("../parcels/ParcelDetailsScreen.tsx");
  assert.ok(p.includes("parcelHasOpenDispute(parcel.id, bookings.bookings)"));
  assert.ok(p.includes("A dispute is open on this delivery."));
  assert.ok(!p.includes('status === "disputed"'));
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-10-28T12:00:00Z");

test("delivered bookings take a dispute for 7 days only", () => {
  const recent = { id: "r", status: "delivered", delivered_at: new Date(NOW - 6 * DAY).toISOString() };
  const old = { id: "o", status: "delivered", delivered_at: new Date(NOW - 8 * DAY).toISOString() };
  const unknown = { id: "u", status: "delivered", delivered_at: null };
  assert.equal(deliveredWindowClosed(recent, NOW), false);
  assert.equal(deliveredWindowClosed(old, NOW), true);
  assert.equal(deliveredWindowClosed(unknown, NOW), false);
  assert.deepEqual(eligibleDisputeBookings([recent, old, unknown], new Set(), NOW).map((b) => b.id), ["r", "u"]);
  assert.deepEqual(windowClosedBookings([recent, old], new Set(), NOW).map((b) => b.id), ["o"]);
  assert.equal(DELIVERED_WINDOW_CLOSED_TEXT, "Disputes can be raised up to 7 days after delivery. Contact support if you need help.");
});

test("a dispute holds 24 files in all, 8 per upload", () => {
  assert.equal(evidenceRoom(0), 8);
  assert.equal(evidenceRoom(20), 4);
  assert.equal(evidenceRoom(24), 0);
  assert.equal(evidenceCountLabel(5), "5/24 files");
  const pick = Array.from({ length: 6 }, (_, i) => ({ uri: `u${i}`, name: `f${i}.jpg`, mimeType: "image/jpeg", size: 1 }));
  const s = screenEvidence(pick, 1, 20);
  assert.equal(s.files.length, 4);
  assert.equal(skippedEvidenceMessage(s), "2 not added. A dispute can have up to 24 files.");
});

test("resolved disputes: closed note, composer capped like chat", () => {
  const d = src("./DisputesScreen.tsx");
  assert.equal(DISPUTE_CLOSED_TEXT, "This dispute is resolved, so it is closed for new messages and evidence.");
  assert.ok(d.includes("{isFiler && isResolved ? ("));
  assert.ok(d.includes("maxLength={MESSAGE_MAX_LENGTH}"));
  assert.ok(d.includes("messageCounter(draft.length)"));
  assert.ok(d.includes("screenEvidence(picked, Date.now(), evidence.length)"));
  const f = src("./FileDisputeScreen.tsx");
  assert.ok(f.includes("DELIVERED_WINDOW_CLOSED_TEXT"));
});

test("a dispute never keeps a booking reading Disputed once resolved", () => {
  // Open (new field, or an older backend with only the booking status).
  assert.deepEqual(bookingDisputeView({ status: "disputed", dispute_status: "open" }), {
    disputedChip: true, note: null, link: "View dispute",
  });
  assert.equal(bookingDisputeView({ status: "disputed" }).disputedChip, true);
  assert.equal(bookingDisputeView({ status: "disputed", dispute_status: "investigating" }).disputedChip, true);
  // Dismissed while the delivery is under way.
  assert.deepEqual(bookingDisputeView({ status: "in_transit", dispute_status: "resolved" }), {
    disputedChip: false, note: "Dispute resolved — the delivery continues.", link: "View dispute",
  });
  // Refund / release: finished state + a resolved link.
  for (const status of ["cancelled", "delivered"]) {
    assert.deepEqual(bookingDisputeView({ status, dispute_status: "resolved" }), {
      disputedChip: false, note: null, link: "Dispute resolved",
    });
  }
  // No dispute at all.
  assert.deepEqual(bookingDisputeView({ status: "in_transit" }), { disputedChip: false, note: null, link: null });
  assert.deepEqual(bookingDisputeView({ status: "in_transit", dispute_status: null }), { disputedChip: false, note: null, link: null });
  // Chip text.
  assert.equal(chipStatusLabel({ status: "disputed", dispute_status: "resolved" }, "Disputed"), "Dispute resolved");
  assert.equal(chipStatusLabel({ status: "disputed" }, "Disputed"), "Disputed");
  assert.equal(chipStatusLabel({ status: "delivered", dispute_status: "resolved" }, "Delivered"), "Delivered");
  const row = src("../bookings/components/BookingRowSummary.tsx");
  assert.ok(row.includes("staleDisputed ? chipStatusLabel(booking, \"\")"));
  assert.ok(row.includes("{bookingStatusLabel(booking.status)}"), "pinned chip text kept");
});
