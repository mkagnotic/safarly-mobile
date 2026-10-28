import { test } from "node:test";
import assert from "node:assert/strict";

import {
  ALLOWED_TYPES,
  attachmentLabel,
  attachmentProblem,
  DOCUMENT_PICKER_TYPES,
  FILE_TOO_LARGE_MESSAGE,
  isAllowedAttachmentType,
  resolveAttachmentType,
  UNSUPPORTED_TYPE_MESSAGE,
  VIDEO_TOO_LARGE_MESSAGE,
} from "./chatAttachments.ts";

const MB = 1024 * 1024;

test("the allow-list is the server's (message-handler media.ts) - same as web", () => {
  assert.deepEqual([...ALLOWED_TYPES], [
    "image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp",
    "application/pdf",
    "video/mp4", "video/webm", "video/quicktime",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  ]);
});

test("files the server refuses are refused before upload, with web's words", () => {
  for (const t of ["video/3gpp", "video/x-matroska", "image/heic", "application/zip", "application/octet-stream", null]) {
    assert.equal(attachmentProblem(t, 1000), UNSUPPORTED_TYPE_MESSAGE, String(t));
  }
  assert.equal(UNSUPPORTED_TYPE_MESSAGE, "Unsupported file type. Allowed: images, PDF, video, Word docs");
});

test("sizes: 5 MB for images and documents, 10 MB for video, 'or smaller'", () => {
  assert.equal(attachmentProblem("image/jpeg", 5 * MB), null);
  assert.equal(attachmentProblem("image/jpeg", 5 * MB + 1), FILE_TOO_LARGE_MESSAGE);
  assert.equal(attachmentProblem("application/pdf", 6 * MB), FILE_TOO_LARGE_MESSAGE);
  assert.equal(attachmentProblem("video/mp4", 10 * MB), null);
  assert.equal(attachmentProblem("video/mp4", 10 * MB + 1), VIDEO_TOO_LARGE_MESSAGE);
  assert.equal(FILE_TOO_LARGE_MESSAGE, "Images and documents must be 5 MB or smaller.");
  assert.equal(VIDEO_TOO_LARGE_MESSAGE, "Videos must be 10 MB or smaller.");
  // Unknown size: the server's check has the last word.
  assert.equal(attachmentProblem("application/pdf", null), null);
});

test("a missing / octet-stream type falls back to the file extension", () => {
  assert.equal(resolveAttachmentType(null, "ticket.PDF"), "application/pdf");
  assert.equal(
    resolveAttachmentType("application/octet-stream", "a.docx"),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(resolveAttachmentType(undefined, "clip.mov"), "video/quicktime");
  assert.equal(resolveAttachmentType(null, "clip.3gp"), null);
  assert.equal(resolveAttachmentType("image/png", "x.jpg"), "image/png");
  assert.equal(isAllowedAttachmentType(resolveAttachmentType(null, "noext")), false);
});

test("the document picker takes PDF and Word only (no video/*)", () => {
  assert.ok(!DOCUMENT_PICKER_TYPES.some((t) => t.startsWith("video/")));
  assert.ok(DOCUMENT_PICKER_TYPES.includes("application/pdf"));
});

test("a document bubble shows the file name, else the type (= web)", () => {
  assert.equal(attachmentLabel("ticket.pdf", "application/pdf"), "ticket.pdf");
  assert.equal(attachmentLabel(null, "application/pdf"), "PDF Document");
  assert.equal(attachmentLabel("  ", "application/msword"), "Word Document");
  assert.equal(attachmentLabel(undefined, "video/mp4"), "Video");
});
