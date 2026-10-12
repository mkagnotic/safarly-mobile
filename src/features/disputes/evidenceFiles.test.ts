import assert from "node:assert/strict";
import { test } from "node:test";

import {
  EVIDENCE_MAX_BYTES,
  EVIDENCE_MAX_FILES,
  evidenceMimeType,
  screenEvidence,
  skippedEvidenceMessage,
} from "./evidenceFiles.ts";

test("accepts the server's types: JPEG, PNG, WebP, GIF and PDF", () => {
  const s = screenEvidence([
    { uri: "a", name: "a.jpg", mimeType: "image/jpeg", size: 100 },
    { uri: "b", name: "b.png", mimeType: "image/png" },
    { uri: "c", name: "c.webp", mimeType: "image/webp" },
    { uri: "d", name: "d.gif", mimeType: "image/gif" },
    { uri: "e", name: "e.pdf", mimeType: "application/pdf" },
  ]);
  assert.equal(s.files.length, 5);
  assert.equal(skippedEvidenceMessage(s), null);
});

test("rejects HEIC, video and anything else the server would drop", () => {
  const s = screenEvidence([
    { uri: "a", name: "a.heic", mimeType: "image/heic" },
    { uri: "b", name: "b.mov", mimeType: "video/quicktime" },
  ]);
  assert.equal(s.files.length, 0);
  assert.equal(s.unsupported, 2);
});

test("rejects files over 10 MB", () => {
  const s = screenEvidence([{ uri: "a", name: "a.jpg", mimeType: "image/jpeg", size: EVIDENCE_MAX_BYTES + 1 }]);
  assert.equal(s.tooLarge, 1);
  assert.match(skippedEvidenceMessage(s) ?? "", /over 10 MB/);
});

test("keeps at most 8 per upload", () => {
  const many = Array.from({ length: 11 }, (_, i) => ({ uri: `u${i}`, name: `p${i}.jpg`, mimeType: "image/jpeg" }));
  const s = screenEvidence(many);
  assert.equal(s.files.length, EVIDENCE_MAX_FILES);
  assert.equal(s.overLimit, 3);
});

test("infers the type from the extension when the picker gives none", () => {
  assert.equal(evidenceMimeType({ uri: "file:///x/receipt.PDF" }), "application/pdf");
  assert.equal(evidenceMimeType({ uri: "file:///x/y", name: "photo.jpeg" }), "image/jpeg");
  const s = screenEvidence([{ uri: "file:///x/y.png" }], 1);
  assert.deepEqual(s.files, [{ uri: "file:///x/y.png", name: "evidence-1-0.png", type: "image/png" }]);
});
