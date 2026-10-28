import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

/**
 * Source checks for the chat-prompts spec (28 Oct 2026) - the parts that live
 * in React Native components node:test cannot render. The pure rules are tested
 * in lib/*.test.ts.
 */
const read = (p: string) => readFileSync(p, "utf8");

const OFFER_ACTIONS = read("src/features/messages/chat/hooks/useChatOfferActions.ts");
const PARCEL = read("src/components/chat/ParcelReviewModal.tsx");
const TRAVEL = read("src/components/chat/TravelDocModal.tsx");
const PAYOUT = read("src/components/chat/PayoutRequiredModal.tsx");
const ATTACHMENT = read("src/features/messages/chat/bubbles/Attachment.tsx");
const BUBBLE = read("src/features/messages/chat/bubbles/MessageBubble.tsx");
const COMPOSER = read("src/features/messages/chat/components/ChatComposer.tsx");
const COMPOSER_HOOK = read("src/features/messages/chat/hooks/useChatComposer.ts");
const MESSAGES_HOOK = read("src/hooks/api/useChatMessages.ts");
const MESSAGES_API = read("src/services/api/messages.ts");
const ATTACH_SHEET = read("src/features/messages/chat/components/AttachSheet.tsx");
const VERIFICATION = read("src/features/messages/chat/hooks/useChatVerification.ts");
const PIN = read("src/features/messages/ChatWorkflowPin.tsx");
const LIST = read("src/features/messages/chat/components/ChatMessageList.tsx");
const OFFER_BAR = read("src/features/messages/chat/components/OfferBar.tsx");
const PAY = read("src/features/bookings/PayBookingScreen.tsx");

test("bug 1: accepting an offer stays in the chat (handoff-first, no jump to Pay)", () => {
  assert.doesNotMatch(OFFER_ACTIONS, /navigate\("PayBookingTab"/);
  assert.match(OFFER_ACTIONS, /Offer accepted — match confirmed!/);
});

test("bug 4: out of parcel-photo tries offers a working Cancel, never Upload", () => {
  const triesUsed = PARCEL.slice(PARCEL.indexOf('testID="parcel-tries-used"'), PARCEL.indexOf("const triesHint"));
  assert.match(triesUsed, /<CancelRequestControl/);
  assert.doesNotMatch(triesUsed, /Submit for review|Upload/);
  assert.match(PARCEL, /Yes, cancel request/);
  assert.match(PARCEL, />Keep</);
});

test("bugs 4/5: the pin decides 'no tries' from the tries, not the server label", () => {
  assert.match(PIN, /outOfTriesCta\(cta\.code, uploadTries/);
  assert.match(PIN, /noTries\?\.button \?\? ctaButtonText\(cta\.code\)/);
});

test("bug 6: the sender sees 'Under review by our team' once the traveler is out of tries", () => {
  assert.match(TRAVEL, /title="Under review by our team"/);
  assert.match(TRAVEL, /The traveler has no tries left\. Our team will review the document and let you both know\./);
});

test("bug 8: the payout dialog names no processor (Razorpay serves India)", () => {
  assert.doesNotMatch(PAYOUT, /Handled securely by Stripe/);
  assert.match(PAYOUT, /Handled securely by our payment partner — Safarly never stores your bank details\./);
  assert.match(PAYOUT, /you'll come straight back to finish accepting\./);
});

test("bug 9: a failed upload leaves no bubble; Retry re-sends with the file", () => {
  assert.match(MESSAGES_HOOK, /throw new ChatSendError\("upload", err\)/);
  assert.match(MESSAGES_HOOK, /const payload = retryPayload\(item\)/);
  assert.match(COMPOSER, /Upload failed — tap retry/);
});

test("bug 10: one failure signal - the composer follows sendFailurePlan", () => {
  assert.match(COMPOSER_HOOK, /sendFailurePlan\(/);
  assert.doesNotMatch(COMPOSER_HOOK, /if \(draftSnapshot\) setDraft\(draftSnapshot\);\n\s*if \(fileToSend\) setUploadFailed\(true\);\n\s*showToast/);
  assert.match(BUBBLE, />Not sent</);
  assert.match(BUBBLE, />Retry</);
  assert.match(BUBBLE, />Discard</);
});

test("bug 13: no live X while uploading", () => {
  assert.match(COMPOSER, /\{uploading \? \(\s*<ActivityIndicator[^]*?accessibilityLabel="Remove attachment"/);
});

test("bug 14: attachments carry and show their file name", () => {
  assert.match(MESSAGES_API, /attachment_name: attachment\?\.name,/);
  assert.match(MESSAGES_HOOK, /name: file\.name/);
  assert.match(BUBBLE, /name=\{message\.attachment_name\}/);
  assert.match(ATTACHMENT, /attachmentLabel\(name, type\)/);
});

test("bug 15: opening an attachment that fails says so", () => {
  assert.doesNotMatch(ATTACHMENT, /void Linking\.openURL/);
  assert.match(ATTACHMENT, /Alert\.alert\("Couldn't open the file", "Please try again\."\)/);
  assert.match(ATTACHMENT, /"Opening…"/);
});

test("bug 16: client type check before upload; no video/* or octet-stream", () => {
  assert.match(COMPOSER_HOOK, /attachmentProblem\(type, asset\.size\)/);
  assert.doesNotMatch(COMPOSER_HOOK, /"video\/\*"/);
  assert.doesNotMatch(COMPOSER_HOOK, /application\/octet-stream/);
  assert.match(COMPOSER_HOOK, /mediaTypes: \["images", "videos"\]/);
});

test("bug 17: over-limit picks are reported, not dropped silently", () => {
  assert.match(TRAVEL, /You can add up to \$\{maxFiles\} files per try\./);
  assert.match(PARCEL, /You can add up to \$\{maxPhotos\} photos per try\./);
});

test("message cap: maxLength 2000 with a counter from 1,800", () => {
  assert.match(COMPOSER, /maxLength=\{MESSAGE_MAX_LENGTH\}/);
  assert.match(COMPOSER, /messageCounter\(draft\.length\)/);
});

test("wording: same words as web", () => {
  for (const src of [TRAVEL, PIN]) assert.doesNotMatch(src, /traveller/);
  assert.match(PIN, /Waiting for the carrier to review your parcel photos/);
  assert.match(PIN, /The traveler uploaded their travel document — review it\./);
  assert.match(PIN, /The carrier is reviewing them\./);
  assert.match(ATTACH_SHEET, /label="Photo or video"/);
  assert.match(ATTACH_SHEET, /label="Take a photo"/);
  assert.match(ATTACH_SHEET, /label="Document \(PDF or Word\)"/);
  for (const src of [TRAVEL, PARCEL]) {
    assert.doesNotMatch(src, /must be under 10 MB/);
    assert.match(src, /Each file must be 10 MB or smaller\./);
  }
  assert.match(PARCEL, /\/\{maxPhotos\} added/);
  assert.match(TRAVEL, /label="Photos" onPress=\{pickImage\}/);
  for (const t of [
    "Travel document uploaded — awaiting review",
    "Travel document approved",
    "Admin review requested — our team will follow up",
    "Match cancelled",
    "Parcel photos uploaded — awaiting carrier review",
    "Parcel approved",
    "Changes requested",
    "Request cancelled",
  ]) assert.ok(VERIFICATION.includes(`title: "${t}"`), t);
});

test("loaders: skeleton thread, busy text on every step button", () => {
  assert.match(LIST, /<MessageSkeleton \/>/);
  for (const [src, labels] of [
    [PARCEL, ["Uploading…", "Approving…", "Sending…", "Cancelling…"]],
    [TRAVEL, ["Uploading…", "Approving…", "Sending…", "Cancelling…"]],
    [OFFER_BAR, ["Accepting…", "Declining…"]],
  ] as const) {
    for (const l of labels) assert.ok(src.includes(`<BusyLabel label="${l}"`), l);
  }
  assert.match(PAY, /Opening payment…/);
});
