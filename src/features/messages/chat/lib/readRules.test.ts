import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { shouldMarkIncomingRead } from "./readRules.ts";

// Client, 28 Oct 2026: "in chat, message is read but still the count shows as unread".

test("a message from the other side into the open chat, app in front: read", () => {
  assert.equal(shouldMarkIncomingRead({ senderId: "them", currentUserId: "me", appState: "active" }), true);
});

test("my own message, a backgrounded app, or no user: not marked", () => {
  assert.equal(shouldMarkIncomingRead({ senderId: "me", currentUserId: "me", appState: "active" }), false);
  assert.equal(shouldMarkIncomingRead({ senderId: "them", currentUserId: "me", appState: "background" }), false);
  assert.equal(shouldMarkIncomingRead({ senderId: "them", currentUserId: "me", appState: "inactive" }), false);
  assert.equal(shouldMarkIncomingRead({ senderId: undefined, currentUserId: "me", appState: "active" }), false);
  assert.equal(shouldMarkIncomingRead({ senderId: "them", currentUserId: null, appState: "active" }), false);
});

test("fence: the open chat marks incoming messages read and recounts after every fetch", () => {
  const hook = readFileSync(new URL("../../../../hooks/api/useChatMessages.ts", import.meta.url), "utf8");
  assert.match(hook, /shouldMarkIncomingRead\(\{[\s\S]*?\}\)\) void markOpenThreadRead\(conversationId\)/);
  assert.match(hook, /setHasMore\(!!res\.data\?\.has_more\);\s*\/\/[^\n]*\n[^\n]*\n\s*recountAfterThreadRead\(\);/);
  const helper = readFileSync(new URL("../markOpenThreadRead.ts", import.meta.url), "utf8");
  assert.match(helper, /messagesApi\.markRead\(conversationId\)/);
  assert.match(helper, /refreshUnreadInboxCount\(\)/);
  assert.match(helper, /bumpRealtimeTopic\("notifications"\)/);
  const api = readFileSync(new URL("../../../../services/api/messages.ts", import.meta.url), "utf8");
  assert.match(api, /conversations\/\$\{conversationId\}\/mark-read/);
});
