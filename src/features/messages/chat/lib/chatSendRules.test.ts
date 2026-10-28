import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ChatSendError,
  MESSAGE_MAX_LENGTH,
  MESSAGE_TOO_LONG_TEXT,
  messageCounter,
  retryPayload,
  sendFailurePlan,
} from "./chatSendRules.ts";

test("message cap is 2,000 and the counter shows only from 1,800", () => {
  assert.equal(MESSAGE_MAX_LENGTH, 2000);
  assert.equal(messageCounter(0), null);
  assert.equal(messageCounter(1799), null);
  assert.equal(messageCounter(1800), "1,800/2,000");
  assert.equal(messageCounter(1850), "1,850/2,000");
  assert.equal(messageCounter(2000), "2,000/2,000");
});

test("a failed UPLOAD: no bubble, file kept for the composer retry, caption back, no toast", () => {
  assert.deepEqual(
    sendFailurePlan({ phase: "upload", hadFile: true, code: "NETWORK_ERROR", message: "x" }),
    { keepBubble: false, restoreDraft: true, keepFile: true, notice: null },
  );
});

test("a failed SEND: only the failed bubble - no toast, no draft restore (no double send)", () => {
  assert.deepEqual(
    sendFailurePlan({ phase: "send", hadFile: false, code: "INTERNAL_ERROR", message: "boom" }),
    { keepBubble: true, restoreDraft: false, keepFile: false, notice: null },
  );
  // With an already-uploaded file: the bubble carries it, the composer lets go.
  assert.equal(sendFailurePlan({ phase: "send", hadFile: true, code: null, message: null }).keepFile, false);
});

test("a refusal a retry cannot fix: the server's reason, text back, no bubble", () => {
  const plan = sendFailurePlan({
    phase: "send",
    hadFile: false,
    code: "VALIDATION_ERROR",
    message: "Sharing phone numbers is not allowed in messages",
  });
  assert.deepEqual(plan, {
    keepBubble: false,
    restoreDraft: true,
    keepFile: false,
    notice: "Sharing phone numbers is not allowed in messages",
  });
});

test("the server's length refusal reads 'Messages can be up to 2,000 characters.'", () => {
  assert.equal(MESSAGE_TOO_LONG_TEXT, "Messages can be up to 2,000 characters.");
  for (const m of ["Message must be 2000 characters or fewer", "Message is too long", "Max 2,000 characters"]) {
    assert.equal(
      sendFailurePlan({ phase: "send", hadFile: false, code: "VALIDATION_ERROR", message: m }).notice,
      MESSAGE_TOO_LONG_TEXT,
      m,
    );
  }
});

test("ChatSendError keeps the phase and the server code", () => {
  const e = new ChatSendError("upload", Object.assign(new Error("nope"), { code: "VALIDATION_ERROR" }));
  assert.equal(e.phase, "upload");
  assert.equal(e.code, "VALIDATION_ERROR");
  assert.ok(e instanceof ChatSendError);
});

test("Retry re-sends WITH the uploaded file and its name", () => {
  assert.deepEqual(
    retryPayload({
      text: "📎 Attachment",
      attachment_url: "https://x/f.pdf",
      attachment_type: "application/pdf",
      attachment_name: "ticket.pdf",
    }),
    { text: "", attachment: { url: "https://x/f.pdf", type: "application/pdf", name: "ticket.pdf" } },
  );
  assert.deepEqual(retryPayload({ text: "hi", attachment_url: null, attachment_type: null }), { text: "hi" });
  // Nothing to send (an upload that never finished): no empty send for the server to refuse.
  assert.equal(retryPayload({ text: "📎 Attachment", attachment_url: null, attachment_type: "image/jpeg" }), null);
});
