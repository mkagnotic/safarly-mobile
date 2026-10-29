import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { profileFormChanged } from "./profileUtils.ts";

/** Edit profile (28 Oct 2026 edit canon): Save compares values, waits for a photo upload. */

const stored = { name: "Asha Rao", bio: "Hi", city: "Pune", country: "IN", avatar_url: "https://x/a.jpg" };
const same = { name: "Asha Rao", bio: "Hi", city: "Pune", country: "IN", avatarUrl: "https://x/a.jpg" };

test("typing and undoing it is nothing to save", () => {
  assert.equal(profileFormChanged(same, stored), false);
  assert.equal(profileFormChanged({ ...same, name: "Asha R" }, stored), true);
  assert.equal(profileFormChanged({ ...same, avatarUrl: null }, stored), true);
  assert.equal(profileFormChanged({ ...same, country: null }, { ...stored, country: null }), false);
  assert.equal(profileFormChanged({ name: "", bio: "", city: "", country: null, avatarUrl: null }, {}), false);
});

const SCREEN = readFileSync("src/features/profile/EditProfileScreen.tsx", "utf8");
const AVATAR = readFileSync("src/components/ui/AvatarUpload.tsx", "utf8");

test("B10: Save is off while the new photo uploads", () => {
  assert.match(SCREEN, /const saveDisabled = submitting \|\| photoUploading \|\| !dirty;/);
  assert.match(SCREEN, /onUploadingChange=\{setPhotoUploading\}/);
  assert.match(AVATAR, /onUploadingChange\?\.\(uploading\)/);
});

test("wording: subtitle, busy text, error title, Save changes", () => {
  assert.match(SCREEN, /Update your photo and personal details\./);
  assert.match(SCREEN, /Saving…/);
  assert.match(SCREEN, /title: "Couldn't save your profile"/);
  assert.match(readFileSync("src/i18n/translations.ts", "utf8"), /"profile\.saveChanges": "Save changes",/);
  // The pinned clearable-bio line is untouched.
  assert.ok(SCREEN.includes("        bio: bio.trim(),"));
});
