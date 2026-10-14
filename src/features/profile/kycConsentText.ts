/**
 * The KYC consent wording. KEEP IDENTICAL to the web app's
 * src/features/profile/lib/kycConsentText.ts: both platforms must show the same
 * text for the same `policy_version` (the server records which version a user
 * agreed to). Draft for legal review: project-docs/ITEM8_KYC_BIOMETRIC_CONSENT_DRAFT.md.
 * The two facts that must be real (retention period, contact address) come
 * from the server setting, so the text can never show a blank.
 */
export interface ConsentFacts {
  retentionDays: number;
  contactEmail: string;
}

export const KYC_CONSENT_TITLE = "Verify your identity";

export function kycConsentParagraphs({ retentionDays, contactEmail }: ConsentFacts): string[] {
  return [
    "To keep deliveries safe, we need to confirm you are who you say you are. We'll ask for a photo of your government ID (front, and back if it has one) and a selfie.",
    "A member of the Safarly team compares your selfie with the photo on your ID. We don't use automated face recognition, and we don't share these images with anyone outside Safarly unless the law requires it.",
    `We keep these images only until your verification is complete, then for up to ${retentionDays} days in case a review is needed, and delete them after that. We keep the verification result (verified or not) for as long as you have an account.`,
    `You can ask us to delete them sooner at ${contactEmail}. You won't be able to carry parcels until you verify again.`,
  ];
}

export const KYC_CONSENT_AGREEMENT =
  "By tapping \"I agree\", you agree that Safarly may collect and use your ID photo and selfie to verify your identity, as described above.";
