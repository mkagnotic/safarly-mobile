/**
 * Chat attachment rules - the SERVER's allow-list and sizes
 * (message-handler routes/media.ts), checked before upload so a file the
 * server refuses is never sent. Twin of web src/features/messages/lib/attachments.ts.
 *
 * Pure (no React Native imports) so node:test can load it.
 */

export const MAX_FILE_BYTES = 5 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 10 * 1024 * 1024;

export const ALLOWED_TYPES = [
  "image/jpeg", "image/png", "image/jpg", "image/gif", "image/webp",
  "application/pdf",
  "video/mp4", "video/webm", "video/quicktime",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
] as const;

/** Same words as web. */
export const UNSUPPORTED_TYPE_MESSAGE = "Unsupported file type. Allowed: images, PDF, video, Word docs";
export const FILE_TOO_LARGE_MESSAGE = "Images and documents must be 5 MB or smaller.";
export const VIDEO_TOO_LARGE_MESSAGE = "Videos must be 10 MB or smaller.";

/** Document picker filter: PDF and Word only (videos come from the photo library). */
export const DOCUMENT_PICKER_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
];

const EXT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  pdf: "application/pdf",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
};

/**
 * The content type to upload with. The picker's mime type wins; when it gives
 * none (or the generic octet-stream, always refused by the server) the file
 * name's extension decides. Null when neither names a known type.
 */
export function resolveAttachmentType(mimeType: string | null | undefined, name: string | null | undefined): string | null {
  const mime = (mimeType ?? "").trim().toLowerCase();
  if (mime && mime !== "application/octet-stream") return mime;
  const ext = (name ?? "").split(".").pop()?.toLowerCase() ?? "";
  return EXT_TYPES[ext] ?? null;
}

export function isAllowedAttachmentType(type: string | null | undefined): boolean {
  return !!type && (ALLOWED_TYPES as readonly string[]).includes(type.toLowerCase());
}

/**
 * Why this file can't be attached, or null when it can. `size` may be unknown
 * (some pickers give none) - the server's size check then has the last word.
 */
export function attachmentProblem(type: string | null, size: number | null | undefined): string | null {
  if (!isAllowedAttachmentType(type)) return UNSUPPORTED_TYPE_MESSAGE;
  const isVideo = type!.startsWith("video/");
  if (size && size > (isVideo ? MAX_VIDEO_BYTES : MAX_FILE_BYTES)) {
    return isVideo ? VIDEO_TOO_LARGE_MESSAGE : FILE_TOO_LARGE_MESSAGE;
  }
  return null;
}

/** The label a document bubble shows: the stored file name, else the type (= web ThreadMessages). */
export function attachmentLabel(name: string | null | undefined, type: string): string {
  const n = name?.trim();
  if (n) return n;
  if (type.includes("pdf")) return "PDF Document";
  if (type.includes("word")) return "Word Document";
  if (type.startsWith("video/")) return "Video";
  return "Document";
}
