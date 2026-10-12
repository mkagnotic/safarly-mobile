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
