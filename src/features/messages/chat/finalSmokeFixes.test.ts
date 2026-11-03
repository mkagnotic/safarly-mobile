import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const read = (rel: string) => readFileSync(new URL(`../../../../${rel}`, import.meta.url), "utf8").replace(/\r\n/g, "\n");

// Final emulator smoke, 3 Nov 2026 - four rough edges fixed before release.

test("last-try reject button says it ends the match (same words as web)", () => {
  const tries = read("src/features/messages/chat/lib/verificationTries.ts");
  assert.ok(tries.includes('export const LAST_TRY_REJECT_BUTTON = "Reject and end match";'));
  assert.ok(read("src/components/chat/TravelDocModal.tsx").includes('{isLastTry(doc, 3) ? LAST_TRY_REJECT_BUTTON : "Request re-upload"}'));
  assert.ok(read("src/components/chat/ParcelReviewModal.tsx").includes('{isLastTry(review, 5) ? LAST_TRY_REJECT_BUTTON : "Request changes"}'));
});

test("Send Parcel: the photos sit INSIDE the amount card, above the amount", () => {
  const s = read("src/features/parcels/SendParcelScreen.tsx");
  const card = s.indexOf("<SectionCard last>");
  const photos = s.indexOf('label="Parcel photos or documents"');
  const cost = s.indexOf("<View style={styles.costRow}>");
  assert.ok(card >= 0 && card < photos && photos < cost, "photos between the card's start and the amount row");
  assert.ok(!s.includes('<View style={styles.submitRow}>\n          <ListingFilesField'), "not floating between cards");
});

test("travel card tag: no letterSpacing with textTransform (Android clipped it to 'YOUR')", () => {
  const s = read("src/features/travels/TravelCard.tsx");
  const tagStyle = s.slice(s.indexOf("  tagText: {"), s.indexOf("  tagMuted:"));
  assert.ok(tagStyle.includes('textTransform: "uppercase"'));
  assert.ok(!tagStyle.includes("letterSpacing"));
});

test("live search updates refetch quietly (no skeletons, an open photo viewer stays open)", () => {
  const s = read("src/hooks/api/useSearchMatches.ts");
  assert.ok(s.includes('useRealtimeBus("discovery", silentRefetch);'));
  assert.ok(!s.includes('useRealtimeBus("discovery", refetch);'));
});
