import { useCallback, useState } from "react";

import {
  ApiClientError,
  kycApi,
  type KycDocType,
  type KycUploadFile,
} from "@/services/api";

export interface SubmitKycArgs {
  docType: KycDocType;
  doc: KycUploadFile;
  selfie: KycUploadFile;
}

export interface UseSubmitKycResult {
  submitting: boolean;
  error: ApiClientError | Error | null;
  /** Uploads both files then commits the submission. Returns the new status, or null on failure. */
  submit: (args: SubmitKycArgs) => Promise<string | null>;
  clearError: () => void;
}

/**
 * Uploads the document + selfie directly to storage (in parallel), then POSTs
 * only their paths to `/kyc-handler/submit`. Submit is the commit point: if any
 * upload or the POST fails we surface the error and the caller retries the whole
 * step — we never try to resume from a half-uploaded state (edge case 18).
 */
export function useSubmitKyc(): UseSubmitKycResult {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<ApiClientError | Error | null>(null);

  const submit = useCallback(async ({ docType, doc, selfie }: SubmitKycArgs): Promise<string | null> => {
    setSubmitting(true);
    setError(null);
    try {
      const [docPath, selfiePath] = await Promise.all([
        kycApi.uploadDocument(doc, "doc_front"),
        kycApi.uploadDocument(selfie, "selfie"),
      ]);
      const res = await kycApi.submit({
        doc_type: docType,
        files: [
          // file_name lets admins see the original PDF/photo name (web parity).
          { file_type: "doc_front", storage_path: docPath, file_name: doc.name ?? undefined },
          { file_type: "selfie", storage_path: selfiePath },
        ],
      });
      return res.data?.status ?? "pending";
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      return null;
    } finally {
      setSubmitting(false);
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { submitting, error, submit, clearError };
}
