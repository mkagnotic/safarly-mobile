import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import {
  ADD_PHOTOS_LABEL,
  addPhotos,
  CARRIERS_PHOTOS_TITLE,
  HANDOFF_PHOTOS_MAX,
  PHOTO_LIMIT_MESSAGE,
  photoCounter,
  rejectHandoffBody,
  rejectionPhotoUrls,
  remainingPhotoSlots,
  removePhotoAt,
  UPLOADING_PHOTOS,
} from "./handoffPhotos.ts";

// 3 Nov 2026: a carrier declining a parcel could attach ONE photo and the
// receiver never saw it. Now up to 5, shown to both parties. Same words as web.

const src = (rel: string) => readFileSync(new URL(rel, import.meta.url), "utf8");

test("max is 5 and the picker gets the remaining slots", () => {
  assert.equal(HANDOFF_PHOTOS_MAX, 5);
  assert.equal(remainingPhotoSlots(0), 5);
  assert.equal(remainingPhotoSlots(2), 3);
  assert.equal(remainingPhotoSlots(5), 0);
  assert.equal(remainingPhotoSlots(7), 0);
  assert.equal(remainingPhotoSlots(-1), 5);
});

test("adding keeps at most 5 and reports what it dropped", () => {
  assert.deepEqual(addPhotos([1, 2], [3, 4]), { photos: [1, 2, 3, 4], overflow: false });
  assert.deepEqual(addPhotos([1, 2, 3], [4, 5, 6, 7]), { photos: [1, 2, 3, 4, 5], overflow: true });
  assert.deepEqual(addPhotos([1, 2, 3, 4, 5], [6]), { photos: [1, 2, 3, 4, 5], overflow: true });
});

test("× removes only that photo", () => {
  assert.deepEqual(removePhotoAt(["a", "b", "c"], 1), ["a", "c"]);
  assert.deepEqual(removePhotoAt(["a"], 3), ["a"]);
});

test("counter reads 2/5", () => {
  assert.equal(photoCounter(0), "0/5");
  assert.equal(photoCounter(2), "2/5");
  assert.equal(photoCounter(9), "5/5");
});

test("reject body sends photo_paths AND the legacy photo_path (first)", () => {
  assert.deepEqual(rejectHandoffBody("Seal is broken here", true, ["a.jpg", "b.jpg"]), {
    reason: "Seal is broken here",
    parcel_with_carrier: true,
    photo_paths: ["a.jpg", "b.jpg"],
    photo_path: "a.jpg",
  });
});

test("reject body without photos carries neither field", () => {
  const body = rejectHandoffBody("Seal is broken here", false, []);
  assert.deepEqual(body, { reason: "Seal is broken here", parcel_with_carrier: false });
  assert.equal("photo_paths" in body, false);
  assert.equal("photo_path" in body, false);
});

test("reject body never sends more than 5 or empty paths", () => {
  const body = rejectHandoffBody("r", true, ["", "1", "2", "3", "4", "5", "6"]);
  assert.deepEqual(body.photo_paths, ["1", "2", "3", "4", "5"]);
  assert.equal(body.photo_path, "1");
});

test("photo URLs: the new array wins", () => {
  assert.deepEqual(
    rejectionPhotoUrls({ handoff_rejection_proof_urls: ["u1", "u2"], handoff_rejection_proof_url: "u1" }),
    ["u1", "u2"],
  );
});

test("photo URLs: an old backend's single URL becomes a one-item list", () => {
  assert.deepEqual(rejectionPhotoUrls({ handoff_rejection_proof_url: "u1" }), ["u1"]);
  assert.deepEqual(rejectionPhotoUrls({ handoff_rejection_proof_urls: null, handoff_rejection_proof_url: "u1" }), ["u1"]);
});

test("photo URLs: nothing, blanks and duplicates give a clean list", () => {
  assert.deepEqual(rejectionPhotoUrls({}), []);
  assert.deepEqual(rejectionPhotoUrls(null), []);
  assert.deepEqual(rejectionPhotoUrls({ handoff_rejection_proof_url: null }), []);
  assert.deepEqual(rejectionPhotoUrls({ handoff_rejection_proof_urls: [] }), []);
  assert.deepEqual(rejectionPhotoUrls({ handoff_rejection_proof_urls: ["", null, "u", "u", " "] }), ["u"]);
});

test("the exact words, same as web", () => {
  assert.equal(ADD_PHOTOS_LABEL, "Add photos (up to 5)");
  assert.equal(PHOTO_LIMIT_MESSAGE, "You can add up to 5 photos.");
  assert.equal(UPLOADING_PHOTOS, "Uploading photos…");
  assert.equal(CARRIERS_PHOTOS_TITLE, "Carrier's photos");
});

test("modal picks several images, limited to the remaining slots, with × and counter", () => {
  const modal = src("../components/RejectHandoffModal.tsx");
  assert.match(modal, /allowsMultipleSelection: true/);
  assert.match(modal, /selectionLimit: remaining/);
  assert.match(modal, /mediaTypes: \["images"\]/);
  assert.match(modal, /\{photoCounter\(photos\.length\)\}/);
  assert.match(modal, /\{UPLOADING_PHOTOS\}/);
  assert.match(modal, /accessibilityLabel=\{`Remove photo \$\{i \+ 1\}`\}/);
  assert.doesNotMatch(modal, /Add photo evidence \(optional\)/);
});

test("decline uploads every photo, then sends rejectHandoffBody", () => {
  const actions = src("./bookingActions.ts");
  assert.match(actions, /for \(const file of files\.slice\(0, HANDOFF_PHOTOS_MAX\)\)/);
  assert.match(actions, /bookingsApi\.rejectHandoff\(booking\.id, rejectHandoffBody\(reason, withCarrier, paths\)\)/);
});

test("both parties see the carrier's photos on the booking", () => {
  const screen = src("../BookingsScreen.tsx");
  assert.match(screen, /<HandoffRejectionPhotos booking=\{booking\} \/>/);
  const strip = src("../components/HandoffRejectionPhotos.tsx");
  assert.match(strip, /rejectionPhotoUrls\(booking\)/);
  assert.match(strip, /\{CARRIERS_PHOTOS_TITLE\}/);
  assert.match(strip, /<ListingPhotoViewer/);
  assert.match(strip, /flexWrap: "wrap"/);
});
