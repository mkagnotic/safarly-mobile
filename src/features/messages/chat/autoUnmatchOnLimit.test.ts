import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { MATCH_ENDED_TOPICS } from "./lib/matchEndedTopics.ts";

/**
 * Auto-unmatch when the verification limit is reached (client-approved,
 * 3 Nov 2026). The server ends the deal on the final travel-document or
 * parcel-photo rejection; these are source checks for the parts that live in
 * React Native files node:test cannot load. Pure rules: lib/verificationTries.test.ts.
 */
const read = (p: string) => readFileSync(p, "utf8");

const TRAVEL = read("src/components/chat/TravelDocModal.tsx");
const PARCEL = read("src/components/chat/ParcelReviewModal.tsx");
const VERIFICATION = read("src/features/messages/chat/hooks/useChatVerification.ts");
const ACTION_MENU = read("src/features/messages/chat/hooks/useChatActionMenu.ts");
const REFRESH = read("src/features/messages/chat/lib/refreshAfterMatchEnded.ts");
const TRAVEL_HOOK = read("src/hooks/api/useTravelDoc.ts");
const PARCEL_HOOK = read("src/hooks/api/useParcelReview.ts");
const CARRIERS_API = read("src/services/api/carriers.ts");
const SCREEN = read("src/features/messages/OfferChatScreen.tsx");

/** The reject form: from the reason field to the end of its confirm row. */
function rejectForm(src: string, startMarker: string, endMarker: string): string {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker, start);
  assert.ok(start > 0 && end > start, `${startMarker} .. ${endMarker}`);
  return src.slice(start, end);
}

test("both reject forms warn on the last try, above the confirm button, reason field kept", () => {
  const travel = rejectForm(TRAVEL, "<TextInput", "Request re-upload</Text>");
  assert.match(travel, /isLastTry\(doc, 3\)/);
  assert.match(travel, /LAST_TRY_REJECT_WARNING/);
  assert.ok(travel.indexOf("LAST_TRY_REJECT_WARNING") < travel.indexOf("onPress={onReject}"));
  assert.match(travel, /value=\{reason\}/);

  const parcel = rejectForm(PARCEL, 'placeholder="Add a note for the receiver (optional)"', "Request changes</Text>");
  assert.match(parcel, /isLastTry\(review, 5\)/);
  assert.match(parcel, /LAST_TRY_REJECT_WARNING/);
  assert.ok(parcel.indexOf("LAST_TRY_REJECT_WARNING") < parcel.indexOf("onPress={onReject}"));
  assert.match(PARCEL, /REASONS\.map/);
});

test("a reject that ended the match toasts and refreshes like a manual Unmatch", () => {
  assert.equal((VERIFICATION.match(/title: AUTO_UNMATCHED_TOAST/g) ?? []).length, 2);
  assert.equal((VERIFICATION.match(/await refreshAfterMatchEnded\(refetchConversations, refetchActiveDeal\)/g) ?? []).length, 2);
  assert.match(ACTION_MENU, /await refreshAfterMatchEnded\(refetchConversations, refetchActiveDeal\)/);
  assert.match(REFRESH, /for \(const t of MATCH_ENDED_TOPICS\) bumpRealtimeTopic\(t\)/);
  assert.match(REFRESH, /await Promise\.all\(\[refetchConversations\(\), refetchActiveDeal\(\)\]\)/);
  assert.deepEqual([...MATCH_ENDED_TOPICS], ["conversations", "messages", "carrier-requests", "parcels", "trips", "bookings"]);
  // The hooks read the server's flag, through the one pure reader.
  assert.match(TRAVEL_HOOK, /autoUnmatched: rejectEndedMatch\(res\.data\)/);
  assert.match(PARCEL_HOOK, /autoUnmatched: rejectEndedMatch\(res\.data\)/);
});

test("no admin review for the travel document any more", () => {
  for (const src of [TRAVEL, VERIFICATION, TRAVEL_HOOK, CARRIERS_API, SCREEN]) {
    assert.doesNotMatch(src, /requestAdminReview|RequestAdminReview|request-admin-review|requestTravelDocAdminReview/);
    assert.doesNotMatch(src, /Request admin review|Admin review requested/);
  }
  assert.doesNotMatch(TRAVEL, /our team (can|will) review/i);
  assert.doesNotMatch(TRAVEL, /Under review by our team/);
});

test("the 5-photo limit never sends the sender to support", () => {
  assert.doesNotMatch(PARCEL, /contact the Safarly support team/);
  assert.match(PARCEL, /No more photos can be added to this request\./);
});
