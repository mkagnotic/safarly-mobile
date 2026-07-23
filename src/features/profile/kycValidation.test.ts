import assert from "node:assert/strict";
import { test } from "node:test";

import { KYC_MAX_BYTES, kycExtFromMime, validateKycAsset } from "./kycValidation.ts";

test("accepts the allowed image types", () => {
  for (const mimeType of ["image/jpeg", "image/png", "image/webp"]) {
    assert.equal(validateKycAsset({ mimeType, fileSize: 1024 }), null);
  }
});

test("rejects a non-image / unsupported MIME", () => {
  for (const mimeType of ["application/pdf", "text/plain", "image/gif", "image/heic"]) {
    const r = validateKycAsset({ mimeType, fileSize: 1024 });
    assert.ok(r, `expected rejection for ${mimeType}`);
    assert.equal(r.title, "Unsupported format");
  }
});

test("accepts a PDF only when allowPdf is set (doc slot, web parity)", () => {
  // selfie slot (default) rejects PDF; doc slot accepts it.
  assert.ok(validateKycAsset({ mimeType: "application/pdf", fileSize: 1024 }));
  assert.equal(validateKycAsset({ mimeType: "application/pdf", fileSize: 1024 }, { allowPdf: true }), null);
  // allowPdf still rejects other non-image types.
  assert.ok(validateKycAsset({ mimeType: "text/plain", fileSize: 1024 }, { allowPdf: true }));
});

test("rejects an oversized file", () => {
  const r = validateKycAsset({ mimeType: "image/jpeg", fileSize: KYC_MAX_BYTES + 1 });
  assert.ok(r);
  assert.equal(r.title, "File too large");
});

test("accepts a file exactly at the size limit (boundary)", () => {
  assert.equal(validateKycAsset({ mimeType: "image/png", fileSize: KYC_MAX_BYTES }), null);
});

test("MIME check takes precedence over size for a bad-type oversized file", () => {
  const r = validateKycAsset({ mimeType: "application/zip", fileSize: KYC_MAX_BYTES + 999 });
  assert.equal(r?.title, "Unsupported format");
});

test("missing mimeType/fileSize is not a violation (server re-validates)", () => {
  assert.equal(validateKycAsset({}), null);
  assert.equal(validateKycAsset({ mimeType: null, fileSize: null }), null);
  assert.equal(validateKycAsset({ mimeType: "image/png" }), null);
  assert.equal(validateKycAsset({ fileSize: 500 }), null);
});

test("kycExtFromMime maps types and defaults to jpg", () => {
  assert.equal(kycExtFromMime("image/png"), "png");
  assert.equal(kycExtFromMime("image/webp"), "webp");
  assert.equal(kycExtFromMime("image/jpeg"), "jpg");
  assert.equal(kycExtFromMime("application/pdf"), "pdf");
  assert.equal(kycExtFromMime(null), "jpg");
  assert.equal(kycExtFromMime(undefined), "jpg");
});
