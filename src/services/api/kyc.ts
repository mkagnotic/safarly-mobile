import { supabase } from "@/integrations/supabase/client";
import { api } from "./client";

export type KycDocType = "passport" | "drivers_license" | "national_id";
export type KycFileType = "doc_front" | "selfie";

/** A captured-and-uploaded file ready to attach to a submission. */
export interface KycUploadFile {
  uri: string;
  mimeType?: string | null;
  /** File extension without the dot — derived from the picked asset. */
  ext: string;
  /** Original filename (PDFs from the document picker); shown to admin reviewers. */
  name?: string | null;
}

export interface KycSubmissionFile {
  id?: string;
  file_type: string;
  /** Signed view URL — only present on admin/detail reads, never the storage path. */
  url?: string | null;
}

/**
 * Mirrors the web app's `KycSubmission` (the backend contract). `status` uses
 * two naming schemes the client treats as synonyms (see `useKycStatus`):
 * verified≡approved, pending≡submitted.
 */
export interface KycSubmission {
  id: string;
  user_id: string;
  doc_type: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  review_notes: string | null;
  name?: string;
  email?: string;
  country?: string;
  files?: KycSubmissionFile[];
  kyc_document_files?: { id: string; file_type: string; storage_path: string }[];
}

export interface KycSubmitInput {
  doc_type: KycDocType;
  files: { file_type: KycFileType; storage_path: string; file_name?: string }[];
}

/** Private bucket — documents upload directly here; only paths reach the API. */
const KYC_BUCKET = "kyc-documents";

/** Whether consent is needed before verifying, and the facts the text states. */
export interface KycConsentState {
  required: boolean;
  enabled: boolean;
  policy_version: string | null;
  retention_days: number | null;
  contact_email: string | null;
  /** "didit": show the automatic-verification wording. Absent = manual wording. */
  variant?: "didit";
}

/** What the verification screen renders (server-derived; never inferred client-side). Same as web. */
export type KycUiState = "not_started" | "in_progress" | "in_review" | "approved" | "declined" | "attempts_exhausted";

export interface KycStatusBlock {
  provider: "manual" | "didit";
  /** Didit is on AND fully configured (consent wording, retention, contact). */
  available: boolean;
  state: KycUiState;
  attempts_used: number;
  max_attempts: number;
  attempts_left: number;
  can_start: boolean;
  reason: string | null;
  manual_upload: boolean;
  consent_required: boolean;
  session_started_at: string | null;
  /** Only on a `?check=1` read: what asking Didit found. Absent on older servers. */
  check?: { result: "asked" | "unreachable" | "too_soon" | "nothing_to_check"; provider_status?: string | null };
}

export const kycApi = {
  /** Consent before ID/selfie capture (off until legal approves the wording). */
  getConsent: () => api.get<KycConsentState>("/kyc-handler/consent"),
  giveConsent: (policyVersion: string, platform: "android" | "ios", appVersion: string | null) =>
    api.post<{ consented: boolean; policy_version: string }>("/kyc-handler/consent", {
      policy_version: policyVersion,
      platform,
      app_version: appVersion,
    }),

  /** `check` = the user tapped "Check status": the server asks Didit right away. */
  getStatus: (check = false) =>
    api.get<{ status: string; submission: KycSubmission | null; kyc?: KycStatusBlock }>(
      check ? "/kyc-handler/status?check=1" : "/kyc-handler/status",
    ),

  /**
   * Start or resume automatic verification (Didit). The server returns Didit's
   * hosted URL and sends the user back to safarly://kyc-return when they finish.
   */
  initiate: (platform: "android" | "ios") =>
    api.post<{ url: string; session_id: string; state: string }>("/kyc-handler/initiate", { platform }),

  submit: (input: KycSubmitInput) =>
    api.post<{ id: string; status: string }>("/kyc-handler/submit", input),

  /**
   * Uploads a document straight to the private `kyc-documents` bucket (files
   * never pass through the edge function) and returns its storage path. The
   * `upsert:false` + timestamp prefix keep every upload a fresh object so a
   * resubmit can't overwrite prior evidence.
   */
  uploadDocument: async (file: KycUploadFile, fileType: KycFileType): Promise<string> => {
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user?.id;
    if (!userId) throw new Error("Please sign in to upload documents");

    const path = `${userId}/${Date.now()}-${fileType}.${file.ext}`;
    const arrayBuffer = await (await fetch(file.uri)).arrayBuffer();
    const { error } = await supabase.storage.from(KYC_BUCKET).upload(path, arrayBuffer, {
      contentType: file.mimeType ?? "image/jpeg",
      upsert: false,
    });
    if (error) throw error;
    return path;
  },
};
