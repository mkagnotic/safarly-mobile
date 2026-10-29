import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, test } from "node:test";

/**
 * My Travels status pills - one wording on web (lib/helpers.ts) and mobile
 * (28 Oct 2026). statusLabels.ts imports theme tokens through "@/", which node
 * cannot resolve, so this reads the source and evaluates the label maps.
 */

const SRC = readFileSync("src/features/travels/statusLabels.ts", "utf8");
const BUDDY_CARD = readFileSync("src/features/travels/BuddyPartnerCard.tsx", "utf8");
const TRAVEL_CARD = readFileSync("src/features/travels/TravelCard.tsx", "utf8");

function mapOf(name: string): Record<string, string> {
  const m = SRC.match(new RegExp(`export const ${name}[^=]*=\\s*(\\{[\\s\\S]*?\\n\\});`));
  assert.ok(m, `${name} not found`);
  return Function(`return (${m[1]});`)() as Record<string, string>;
}

const STATUS_LABEL = mapOf("STATUS_LABEL");
const BUDDY_STATUS_LABEL = mapOf("BUDDY_STATUS_LABEL");

describe("status labels (web parity, sentence case)", () => {
  test("listing statuses read the same words as web", () => {
    assert.equal(STATUS_LABEL.open, "Looking for a carrier");
    assert.equal(STATUS_LABEL.looking_for_match, "Looking for a carrier");
    assert.equal(STATUS_LABEL.active, "Can carry parcels");
    assert.equal(STATUS_LABEL.can_carry, "Can carry parcels");
    assert.equal(STATUS_LABEL.in_transit, "In transit");
    assert.equal(STATUS_LABEL.pending, "Looking for a match");
    assert.equal(STATUS_LABEL.match_requested, "Match requested");
    assert.equal(STATUS_LABEL.chatting, "Chatting");
    assert.equal(STATUS_LABEL.matched, "Matched");
    assert.equal(STATUS_LABEL.cancelled, "Cancelled");
  });

  test("every label is sentence case - no Title Case words after the first", () => {
    for (const label of [...Object.values(STATUS_LABEL), ...Object.values(BUDDY_STATUS_LABEL)]) {
      const rest = label.split(" ").slice(1);
      assert.ok(rest.every((w) => w === w.toLowerCase()), `not sentence case: "${label}"`);
    }
  });

  test("an unknown status gets no label, never the raw code", () => {
    assert.match(SRC, /return STATUS_LABEL\[status\] \?\? "";/);
    assert.match(SRC, /return BUDDY_STATUS_LABEL\[status\] \?\? "";/);
    assert.match(TRAVEL_CARD, /!!labelForStatus\(status\)/);
  });

  test("buddy listing pill labels the raw status, like web", () => {
    assert.match(BUDDY_CARD, /labelForBuddyStatus\(completed \? "completed" : rawStatus\)/);
  });
});
