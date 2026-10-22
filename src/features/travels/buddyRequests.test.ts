import assert from "node:assert/strict";
import { describe, test } from "node:test";

import {
  CONFIRM_JOURNEY_LOCKED_HINT,
  buddyRequestStatusLabel,
  cancellableSentRequests,
  confirmJourneyLockedLabel,
} from "./buddyRequests.ts";
import { formatLocalDate } from "../../utils/travelDate.ts";

// Mirrors web's `src/test/buddyRequests.test.ts`.

describe("buddyRequestStatusLabel", () => {
  test("reads 'withdrawn' as Cancelled", () => {
    assert.equal(buddyRequestStatusLabel("withdrawn"), "Cancelled");
  });
  test("labels the other states and passes unknown ones through", () => {
    assert.equal(buddyRequestStatusLabel("pending"), "Pending");
    assert.equal(buddyRequestStatusLabel("accepted"), "Accepted");
    assert.equal(buddyRequestStatusLabel("rejected"), "Declined");
    assert.equal(buddyRequestStatusLabel("something_new"), "something_new");
    assert.equal(buddyRequestStatusLabel(undefined), "");
  });
});

describe("cancellableSentRequests", () => {
  const me = "user-me";
  test("keeps only pending rows sent by the viewer, once each", () => {
    const rows = [
      { id: "a", status: "pending", sender_id: me },
      { id: "a", status: "pending", sender_id: me },
      { id: "b", status: "withdrawn", sender_id: me },
      { id: "c", status: "accepted", sender_id: me },
      { id: "d", status: "pending", sender_id: "someone-else" },
      { id: "e", status: "pending", sender_id: me },
    ];
    assert.deepEqual(cancellableSentRequests(rows, me).map((r) => r.id), ["a", "e"]);
  });
  test("is empty for no data", () => {
    assert.deepEqual(cancellableSentRequests(undefined, me), []);
    assert.deepEqual(cancellableSentRequests([], me), []);
  });
  test("does not drop rows when the viewer id is not known yet", () => {
    assert.equal(cancellableSentRequests([{ id: "x", status: "pending", sender_id: "u" }], null).length, 1);
  });
});

describe("confirmJourneyLockedLabel", () => {
  const fmt = (ymd: string) => formatLocalDate(ymd, { month: "short", day: "numeric", locale: "en-US" });

  test("names the day confirmation unlocks", () => {
    assert.equal(confirmJourneyLockedLabel("2026-11-03", fmt), "Confirm journey from Nov 3");
  });

  test("reads a timestamp-shaped value by its calendar day (no UTC shift)", () => {
    assert.equal(confirmJourneyLockedLabel("2026-11-03T00:00:00+00:00", fmt), "Confirm journey from Nov 3");
  });

  test("falls back to the old wording when the date is unknown or unreadable", () => {
    assert.equal(confirmJourneyLockedLabel(null, fmt), "Confirm after trip");
    assert.equal(confirmJourneyLockedLabel("", fmt), "Confirm after trip");
    assert.equal(confirmJourneyLockedLabel("soon", fmt), "Confirm after trip");
    assert.equal(confirmJourneyLockedLabel("2026-11-03", () => "—"), "Confirm after trip");
  });

  test("the hint says why the action is locked", () => {
    assert.equal(CONFIRM_JOURNEY_LOCKED_HINT, "You can confirm your journey once your trip has started.");
  });
});
