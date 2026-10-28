import type { RNUploadFile } from "@/services/api";

/**
 * Client-side mirror of the dispute-evidence limits enforced by
 * `POST /dispute-handler/:id/evidence` (server `evidence.ts`): JPEG / PNG /
 * WebP / GIF / PDF, at most 10 MB each, at most 8 files per upload. Screening
 * here means the user hears WHY a file was left out before anything is sent,
 * instead of finding it missing afterwards.
 */
export const EVIDENCE_MAX_FILES = 8;
/** Total files one dispute can hold, across every upload (server: limit_reached). */
export const EVIDENCE_MAX_PER_DISPUTE = 24;
export const EVIDENCE_TOTAL_LIMIT_TEXT = "A dispute can have up to 24 files.";

/** "5/24 files". */
export function evidenceCountLabel(count: number): string {
  return `${count}/${EVIDENCE_MAX_PER_DISPUTE} files`;
}

/** How many more files this upload may take: 8 at a time, 24 per dispute. */
export function evidenceRoom(existing: number): number {
  return Math.max(0, Math.min(EVIDENCE_MAX_FILES, EVIDENCE_MAX_PER_DISPUTE - existing));
}
export const EVIDENCE_MAX_BYTES = 10 * 1024 * 1024;
export const EVIDENCE_ALLOWED_TYPES: readonly string[] = [
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
];

const TYPE_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  gif: "image/gif",
  pdf: "application/pdf",
};

/** A picked file from either expo-image-picker or expo-document-picker. */
export interface PickedEvidence {
  uri: string;
  name?: string | null;
  mimeType?: string | null;
  size?: number | null;
}

export interface ScreenedEvidence {
  files: RNUploadFile[];
  /** How many were dropped for each reason — for one combined notice. */
  tooLarge: number;
  unsupported: number;
  overLimit: number;
  /** Dropped because the dispute already holds (or would pass) 24 files. */
  overTotal?: number;
}

function extOf(value: string | null | undefined): string {
  const clean = (value ?? "").split("?")[0];
  const dot = clean.lastIndexOf(".");
  return dot >= 0 ? clean.slice(dot + 1).toLowerCase() : "";
}

/** The declared type, falling back to the extension when the picker gave none. */
export function evidenceMimeType(file: PickedEvidence): string {
  const declared = (file.mimeType ?? "").toLowerCase();
  if (declared) return declared;
  return TYPE_BY_EXT[extOf(file.name) || extOf(file.uri)] ?? "application/octet-stream";
}

export function screenEvidence(
  picked: readonly PickedEvidence[],
  now = Date.now(),
  /** Files the dispute (or the form) already holds, toward the 24 total. */
  existing = 0,
): ScreenedEvidence {
  const out: ScreenedEvidence = { files: [], tooLarge: 0, unsupported: 0, overLimit: 0, overTotal: 0 };
  const totalRoom = Math.max(0, EVIDENCE_MAX_PER_DISPUTE - existing);
  picked.forEach((p, i) => {
    const type = evidenceMimeType(p);
    if (!EVIDENCE_ALLOWED_TYPES.includes(type)) {
      out.unsupported += 1;
      return;
    }
    if (p.size != null && p.size > EVIDENCE_MAX_BYTES) {
      out.tooLarge += 1;
      return;
    }
    if (out.files.length >= totalRoom) {
      out.overTotal = (out.overTotal ?? 0) + 1;
      return;
    }
    if (out.files.length >= EVIDENCE_MAX_FILES) {
      out.overLimit += 1;
      return;
    }
    const ext = Object.keys(TYPE_BY_EXT).find((k) => TYPE_BY_EXT[k] === type) ?? "jpg";
    out.files.push({ uri: p.uri, name: p.name || `evidence-${now}-${i}.${ext}`, type });
  });
  return out;
}

/** One sentence naming every reason a file was left out, or null when none was. */
export function skippedEvidenceMessage(s: ScreenedEvidence): string | null {
  const parts: string[] = [];
  if (s.unsupported) parts.push(`${s.unsupported} not a JPEG, PNG, WebP, GIF or PDF`);
  if (s.tooLarge) parts.push(`${s.tooLarge} over 10 MB`);
  if (s.overLimit) parts.push(`${s.overLimit} past the ${EVIDENCE_MAX_FILES}-file limit`);
  const head = parts.length ? `Skipped: ${parts.join("; ")}.` : "";
  const total = s.overTotal ? `${head ? " " : ""}${s.overTotal} not added. ${EVIDENCE_TOTAL_LIMIT_TEXT}` : "";
  return head || total ? head + total : null;
}
