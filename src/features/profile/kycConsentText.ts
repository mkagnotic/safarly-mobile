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

/*
 * The wording for automatic verification by Didit (server `variant: "didit"`,
 * its own policy_version). PENDING CLIENT LEGAL SIGN-OFF — see
 * project-docs/KYC_CONSENT_PRIVACY_DRAFT.md §1. The manual wording above is
 * unchanged and still used whenever the provider switch is on "manual".
 */
export const DIDIT_PRIVACY_NOTICE_URL = "https://didit.me/terms/verification-privacy-notice";

export function diditConsentParagraphs({ retentionDays, contactEmail }: ConsentFacts): { lead?: string; text: string }[] {
  return [
    { text: "To keep deliveries safe, we need to confirm you are who you say you are. You'll photograph your government ID and take a short face scan with your camera." },
    { lead: "Who checks it.", text: "Didit, our identity verification provider, checks your ID automatically, confirms the face scan is of a real person who is present, and compares your face with the photo on your ID. Didit does this for Safarly and only on our instructions. Your data is processed and stored in the European Union." },
    { lead: "Your face template.", text: "To stop one person opening several accounts, Didit turns your face scan into a face template, a set of measurements of your face, and compares it with other Safarly verifications. A face template is biometric data." },
    { lead: "What else is checked.", text: "Your IP address and device details are checked to help prevent fraud. If the automatic check can't decide, a member of the Safarly team reviews it." },
    { lead: "How long it's kept.", text: `Didit deletes your ID images, face scan, face template and the details read from your ID within ${retentionDays} days (about 6 months), or sooner if you delete your account. Safarly keeps only the result (verified or not, the reason, and the date) for as long as you have an account.` },
    { lead: "Your choices.", text: `You can ask us to delete your verification data sooner at ${contactEmail}, or delete your account in the app. Paying for a delivery needs a verified identity, so you would need to verify again first.` },
  ];
}

export const DIDIT_CONSENT_AGREEMENT =
  "By tapping \"I agree\", you give your written consent for Safarly and Didit to collect, use and store your ID images, face scan and face template to verify your identity and prevent fraud, as described above.";
