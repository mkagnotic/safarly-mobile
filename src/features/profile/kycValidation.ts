/**
 * KYC document file rules, shared by the upload picker and unit tests. Pure
 * (no RN imports) so it's exercisable under `node:test`.
 */

export const KYC_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
export const KYC_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export interface KycPickedAsset {
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface KycFileRejection {
  title: string;
  message: string;
}

/**
 * Validates a picked image against the KYC rules (JPG/PNG/WebP, ≤10MB). Returns
 * a rejection to show inline, or `null` when the file is acceptable.
 *
 * `mimeType`/`fileSize` can be absent (some pickers don't report them) — an
 * absent field is not treated as a violation; the server re-validates on submit.
 */
export function validateKycAsset(asset: KycPickedAsset): KycFileRejection | null {
  if (asset.mimeType && !KYC_ALLOWED_MIME.includes(asset.mimeType as (typeof KYC_ALLOWED_MIME)[number])) {
    return { title: "Unsupported format", message: "Please select a JPG, PNG, or WebP image." };
  }
  if (asset.fileSize && asset.fileSize > KYC_MAX_BYTES) {
    return { title: "Image too large", message: "Image must be smaller than 10MB." };
  }
  return null;
}

/** File extension (no dot) for a storage path, derived from MIME. Defaults to jpg. */
export function kycExtFromMime(mime: string | null | undefined): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  return "jpg";
}
