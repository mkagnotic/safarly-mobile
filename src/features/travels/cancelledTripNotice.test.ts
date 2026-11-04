import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { cancelledTripNotice } from "./cancelledTripNotice.ts";

const read = (rel: string) => readFileSync(new URL(`../../../${rel}`, import.meta.url), "utf8");

// The owner's cancelled trip (client, 2 Nov 2026): it stays in the Archive and
// still opens, but it looked like a live trip. Same words as web.
test("cancelled trip: says when it was cancelled", () => {
  assert.equal(
    cancelledTripNotice({ status: "cancelled", deleted_at: "2026-11-02T10:00:00Z" }),
    "This trip was cancelled on Nov 2, 2026. It stays in your archive so you can look back at it.",
  );
});

test("cancelled trip: falls back to the last update, then to no date", () => {
  assert.equal(
    cancelledTripNotice({ status: "cancelled", updated_at: "2026-10-30T12:00:00Z" }),
    "This trip was cancelled on Oct 30, 2026. It stays in your archive so you can look back at it.",
  );
  assert.equal(
    cancelledTripNotice({ status: "cancelled" }),
    "This trip was cancelled. It stays in your archive so you can look back at it.",
  );
});

test("cancelled trip: silent for live, matched and finished trips", () => {
  for (const status of ["active", "looking_for_match", "matched", "in_transit", "completed", "delivered"]) {
    assert.equal(cancelledTripNotice({ status, deleted_at: null }), null);
  }
});

test("trip details: owner sees the notice at the top; the old bottom line is for other closed states", () => {
  const s = read("src/features/trips/TripDetailsScreen.tsx");
  assert.match(s, /isOwner && cancelledTripNotice\(trip\) \?/);
  assert.ok(s.indexOf('testID="trip-cancelled-notice"') < s.indexOf("<TripCard trip={trip} />"));
  assert.match(s, /\) : isOwner && !cancelledTripNotice\(trip\) \? \(/);
});
