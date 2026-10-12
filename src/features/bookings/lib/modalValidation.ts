export const REJECT_REASON_MIN = 10;
export const MAX_EVIDENCE_BYTES = 10 * 1024 * 1024;
/** The evidence types `uploadHandoffEvidence` accepts (web parity). */
export const EVIDENCE_TYPES: ReadonlySet<string> = new Set(["image/jpeg", "image/png", "image/webp"]);

/** MIME type for a picked image, falling back to its file extension. */
export function evidenceMimeType(mimeType: string | null | undefined, name: string | null | undefined): string {
  if (mimeType) return mimeType.toLowerCase() === "image/jpg" ? "image/jpeg" : mimeType.toLowerCase();
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  return ext ? `image/${ext}` : "image/jpeg";
}

/**
 * The hint under a field with a minimum length - or null once the minimum is met.
 *
 * Was "{typed}/{min} characters minimum", which reads as a quota once you are
 * past it: "37/10 characters minimum" looks like 37 out of 10. Now it says what
 * is required and how far off you are, and gets out of the way once you are there.
 */
export function minLengthHint(length: number, min: number): string | null {
  const remaining = min - Math.max(0, length);
  if (remaining <= 0) return null;
  if (length <= 0) return `Minimum ${min} characters`;
  return `Minimum ${min} characters · ${remaining} more needed`;
}
