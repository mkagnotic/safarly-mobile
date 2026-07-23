/**
 * KYC document file rules, shared by the upload picker and unit tests. Pure
 * (no RN imports) so it's exercisable under `node:test`.
 */

export const KYC_ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"] as const;
/** Web parity: the ID document may be a scanned PDF; the selfie stays image-only. */
export const KYC_PDF_MIME = "application/pdf";
export const KYC_MAX_BYTES = 10 * 1024 * 1024; // 10MB

export interface KycPickedAsset {
  mimeType?: string | null;
  fileSize?: number | null;
}

export interface KycValidateOptions {
  /** Doc slot only: also accept a PDF (web parity). Selfie stays image-only. */
  allowPdf?: boolean;
}

export interface KycFileRejection {
  title: string;
  message: string;
}

/**
 * Validates a picked file against the KYC rules (JPG/PNG/WebP, ≤10MB; plus PDF
 * when `allowPdf`). Returns a rejection to show inline, or `null` when the file
 * is acceptable.
 *
 * `mimeType`/`fileSize` can be absent (some pickers don't report them) — an
 * absent field is not treated as a violation; the server re-validates on submit.
 */
export function validateKycAsset(
  asset: KycPickedAsset,
  { allowPdf = false }: KycValidateOptions = {},
): KycFileRejection | null {
  const allowed: readonly string[] = allowPdf ? [...KYC_ALLOWED_MIME, KYC_PDF_MIME] : KYC_ALLOWED_MIME;
  if (asset.mimeType && !allowed.includes(asset.mimeType)) {
    return {
      title: "Unsupported format",
      message: allowPdf
        ? "Please select a JPG, PNG, WebP image, or a PDF."
        : "Please select a JPG, PNG, or WebP image.",
    };
  }
  if (asset.fileSize && asset.fileSize > KYC_MAX_BYTES) {
    return { title: "File too large", message: "File must be smaller than 10MB." };
  }
  return null;
}

/** File extension (no dot) for a storage path, derived from MIME. Defaults to jpg. */
export function kycExtFromMime(mime: string | null | undefined): string {
  if (mime === "image/png") return "png";
  if (mime === "image/webp") return "webp";
  if (mime === KYC_PDF_MIME) return "pdf";
  return "jpg";
}
