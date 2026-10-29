import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import {
  appendWithinCap,
  blockedBannerBody,
  canUnblockConversation,
  capAtCodePoint,
  declineDialogCopy,
  isReportRateLimit,
  matchRequestBody,
  matchResultToast,
  matchWaitingBody,
  openableMedia,
  reportErrorText,
  reportResultToast,
  showMatchRequestRow,
} from "./chatModerationRules.ts";
import { MESSAGE_MAX_LENGTH } from "./chatSendRules.ts";

// Flow-18 spec (28 Oct 2026): chat actions, inbox, emoji, media, report, block.

const src = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8");

test("bug 1: a repeat report says so; a new one says it was sent", () => {
  assert.deepEqual(reportResultToast(true), {
    title: "Already reported",
    message: "You've already reported this — we're on it.",
    variant: "info",
  });
  assert.deepEqual(reportResultToast(false), {
    title: "Report sent",
    message: "Our team reviews reports within 24 hours.",
    variant: "success",
  });
  assert.equal(reportResultToast(undefined).title, "Report sent");
});

test("reports are rate-limited: the server's sentence is shown as sent", () => {
  const limited = { code: "RATE_LIMITED", status: 429, message: "You've sent several reports recently. Please try again later." };
  assert.equal(isReportRateLimit(limited), true);
  assert.equal(reportErrorText(limited, () => "generic"), limited.message);
  assert.equal(reportErrorText(new Error("boom"), () => "generic"), "generic");
  assert.equal(isReportRateLimit({ code: "RATE_LIMITED", status: 429, message: "" }), false);
  assert.equal(isReportRateLimit(null), false);
});

test("bug 3: only the blocker can unblock; legacy blocks stay unblockable", () => {
  assert.equal(canUnblockConversation(true, "me", "me"), true);
  assert.equal(canUnblockConversation(true, "them", "me"), false);
  assert.equal(canUnblockConversation(true, null, "me"), true);
  assert.equal(canUnblockConversation(false, "me", "me"), false);
  assert.equal(blockedBannerBody(true, "Asha Rao"), "You blocked Asha Rao. Unblock them from the menu to message again.");
  assert.equal(blockedBannerBody(false, "Asha Rao"), "You can't send messages in this chat.");
});

test("bug 9: no Send match request once I sent it", () => {
  assert.equal(showMatchRequestRow("pending", false), true);
  assert.equal(showMatchRequestRow("declined", false), true);
  assert.equal(showMatchRequestRow("pending", true), false);
  assert.equal(showMatchRequestRow("matched", false), false);
  assert.equal(showMatchRequestRow("blocked", false), false);
});

test("match wording = web", () => {
  assert.equal(matchRequestBody("Asha Rao", false), "Asha Rao requested a match for this delivery.");
  assert.equal(matchRequestBody("Asha Rao", true), "Asha Rao requested a match for this trip.");
  assert.equal(matchWaitingBody("Asha Rao"), "Match request sent. Waiting for Asha to accept.");
  assert.deepEqual(matchResultToast(true, false), { title: "Match confirmed!" });
  assert.deepEqual(matchResultToast(true, true), { title: "You're now travel buddies!" });
  assert.deepEqual(matchResultToast(false, false), { title: "Match request sent — waiting for them to accept." });
  assert.deepEqual(declineDialogCopy("Asha", true), {
    title: "Decline match request",
    body: "Decline Asha's match request? You can add a reason if you like.",
  });
  assert.equal(declineDialogCopy("Asha", false).title, "Decline match");
});

test("bug 15: an emoji goes in only if the whole emoji fits under 2,000", () => {
  const nearlyFull = "a".repeat(MESSAGE_MAX_LENGTH - 1);
  assert.equal(appendWithinCap(nearlyFull, "😀", MESSAGE_MAX_LENGTH), nearlyFull);
  assert.equal(appendWithinCap("a".repeat(MESSAGE_MAX_LENGTH - 2), "😀", MESSAGE_MAX_LENGTH).length, MESSAGE_MAX_LENGTH);
  assert.equal(appendWithinCap("hi", "👍", MESSAGE_MAX_LENGTH), "hi👍");
});

test("bug 15: a paste is cut at a code-point boundary", () => {
  const text = "a".repeat(MESSAGE_MAX_LENGTH - 1) + "😀";
  const cut = capAtCodePoint(text, MESSAGE_MAX_LENGTH);
  assert.equal(cut.length, MESSAGE_MAX_LENGTH - 1);
  assert.equal(capAtCodePoint("short", MESSAGE_MAX_LENGTH), "short");
  assert.equal(capAtCodePoint("a".repeat(2100), MESSAGE_MAX_LENGTH).length, MESSAGE_MAX_LENGTH);
});

test("bug 16: media items with no link are not shown or counted", () => {
  const items = [
    { id: "1", attachment_url: "https://x/a.jpg" },
    { id: "2", attachment_url: null },
    { id: "3", attachment_url: "" },
  ];
  assert.deepEqual(openableMedia(items).map((m) => m.id), ["1"]);
});

// ── Source checks: the components use the rules above ──

test("chat + bubble report read duplicate and the rate-limit sentence", () => {
  for (const f of ["../hooks/useChatActionMenu.ts", "../hooks/useChatBubbleMenu.ts"]) {
    const s = src(f);
    assert.match(s, /reportResultToast\(res\.data\?\.duplicate\)/);
    assert.match(s, /reportErrorText\(err/);
    assert.doesNotMatch(s, /Thank you for keeping the community safe\./);
  }
  const menu = src("../../../../components/moderation/ModerationMenu.tsx");
  assert.match(menu, /isReportRateLimit\(err\)/);
  assert.match(menu, /reportResultToast\(res\.data\?\.duplicate\)/);
});

test("chat block/unblock: confirm, '{name}' toasts, refresh the block list", () => {
  const s = src("../hooks/useChatActionMenu.ts");
  assert.match(s, /setConfirmAction\("unblock"\)/);
  assert.match(s, /\$\{participantName\} blocked/);
  assert.match(s, /\$\{participantName\} unblocked/);
  assert.equal((s.match(/void refetchBlocks\(\);/g) ?? []).length, 2);
  assert.match(s, /setUnblockPending\(true\);/);
  assert.match(s, /"Couldn't unarchive" : "Couldn't archive"/);
  assert.doesNotMatch(s, /"Couldn't update"/);
  const modals = src("../components/ChatModerationModals.tsx");
  assert.match(modals, /UNBLOCK_CONFIRM_BODY/);
  assert.match(modals, /BLOCK_CONFIRM_BODY/);
  assert.doesNotMatch(modals, /They won't be able to message you/);
});

test("only the blocker sees Unblock; banner and inbox say Decline, not Close", () => {
  const sheet = src("../components/ChatActionsSheet.tsx");
  assert.match(sheet, /\{canUnblock \? \(/);
  assert.match(sheet, /showMatchRequestRow\(matchStatus, matchedByMe\)/);
  const banner = src("../components/MatchStateBanner.tsx");
  assert.match(banner, /blockedBannerBody\(canUnblock, participantName\)/);
  assert.doesNotMatch(banner, />Close</);
  assert.doesNotMatch(banner, /Conversation closed/);
  assert.doesNotMatch(banner, /You blocked this user/);
  const row = src("../../inbox/ConversationRow.tsx");
  assert.doesNotMatch(row, />Close</);
  assert.match(row, /accessibilityLabel="Decline match"/);
  const decline = src("../../../../components/chat/DeclineMatchModal.tsx");
  assert.match(decline, /const confirmLabel = "Decline";/);
  assert.doesNotMatch(decline, /re-open later/);
});

test("bug 11: the unread pill is not an alternative to the row's action", () => {
  const row = src("../../inbox/ConversationRow.tsx");
  assert.doesNotMatch(row, /\) : flags\.hasUnread \? \(/);
  assert.match(row, /\) : null\}\r?\n\s*\{flags\.hasUnread \? \(/);
});

test("emoji insert and media open errors", () => {
  assert.match(src("../../OfferChatScreen.tsx"), /appendWithinCap\(prev, e\.emoji, MESSAGE_MAX_LENGTH\)/);
  assert.match(src("../hooks/useChatComposer.ts"), /capAtCodePoint\(next, MESSAGE_MAX_LENGTH\)/);
  const media = src("../../../../components/chat/MediaGalleryModal.tsx");
  assert.match(media, /Alert\.alert\("Couldn't open the file", "Please try again\."\)/);
  assert.match(media, /openableMedia\(/);
  assert.match(media, /onError=\{\(\) => markBroken\(item\.id\)\}/);
  assert.doesNotMatch(media, /void Linking\.openURL/);
});
