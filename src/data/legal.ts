import {
  COMPANY_BLURB,
  COMPANY_JURISDICTION,
  COMPANY_NAME,
  OWNERSHIP_STATEMENT,
  OWNERSHIP_STATEMENT_TERMS,
  PLATFORM_NAME,
  SUPPORT_EMAIL,
} from "@/constants/company";

export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

/**
 * Shown on the Privacy Policy, Terms of Service and Cookie Policy.
 * Update this whenever the substance of those documents changes.
 */
export const LEGAL_EFFECTIVE_DATE = "20 October 2026";

/**
 * Legal, About and Contact copy.
 * ⚠️ Keep in sync with web `src/data/legal.ts`.
 */

export const termsIntro = OWNERSHIP_STATEMENT_TERMS;
export const privacyIntro = OWNERSHIP_STATEMENT;

export const termsSections: LegalSection[] = [
  {
    title: "1. Overview",
    paragraphs: [
      OWNERSHIP_STATEMENT_TERMS,
      "Safarly is a platform that connects individuals who need to send items with travelers willing to carry them, and also enables travel companionship between users.",
      "Safarly does not physically handle, transport, or store any items.",
    ],
  },
  {
    title: "2. Eligibility",
    paragraphs: [
      "You must be at least 18 years old, and able to form a legally binding contract, to create an account or use Safarly. By using Safarly, you confirm that you meet these requirements.",
    ],
  },
  {
    title: "3. User Roles",
    paragraphs: ["Users may act as:"],
    bullets: [
      "Carrier (Traveler): transports items",
      "Receiver: requests delivery",
      "Travel Buddy: connects for shared travel",
      "Users are solely responsible for their interactions and arrangements.",
    ],
  },
  {
    title: "4. Platform Role",
    paragraphs: ["Safarly:"],
    bullets: [
      "Facilitates connections between users",
      "Processes payments via a third-party provider (for example, Stripe)",
      "Holds funds temporarily until delivery confirmation",
      "Does not guarantee delivery, quality, or safety of items or travel experience",
    ],
  },
  {
    title: "5. Payments & Fees",
    bullets: [
      "Payments are processed through secure third-party providers",
      "Safarly charges a platform fee per transaction",
      "Funds are held and released upon delivery confirmation",
      "Users agree to applicable fees and pricing at the time of booking",
    ],
  },
  {
    title: "6. Refunds & Cancellations",
    bullets: [
      "Full refunds may be issued before a match is confirmed",
      "Partial refunds may apply after a match is confirmed",
      "No refunds once delivery is in progress, except in case of disputes",
    ],
  },
  {
    title: "7. User Responsibilities",
    paragraphs: ["Users agree to:"],
    bullets: [
      "Provide accurate information",
      "Comply with all applicable laws (including customs and airline rules)",
      "Not send prohibited or illegal items",
      "Inspect items before accepting delivery",
      "Carriers have the right to refuse any parcel they deem unsafe or non-compliant",
    ],
  },
  {
    title: "8. Prohibited Items",
    paragraphs: ["Users must not send:"],
    bullets: [
      "Illegal substances",
      "Weapons or hazardous materials",
      "Restricted or regulated goods",
      "Perishable or unsafe items",
      "Safarly is not responsible for violations",
    ],
  },
  {
    title: "9. Community Standards",
    paragraphs: [
      "Safarly has zero tolerance for objectionable content or abusive users. This applies to everything you post or send, including listings, photos, profile details and chat messages.",
      "You can report a message, a listing or a user from the chat, their profile or the listing, and you can block any user. We review reports within 24 hours. Content that breaks these standards is removed, and the accounts responsible are suspended or terminated.",
      "You must not post, send or engage in:",
    ],
    bullets: [
      "Harassment, bullying or threats",
      "Hate speech or discrimination",
      "Sexual or violent content",
      "Spam, scams or fraud",
      "Impersonating another person or organisation",
      "Offering or requesting illegal items",
    ],
  },
  {
    title: "10. Travel Companion Disclaimer",
    paragraphs: ["Safarly facilitates introductions only. Users are responsible for:"],
    bullets: [
      "Verifying identity and comfort level",
      "Making independent decisions regarding travel companionship",
      "Safarly does not guarantee safety, compatibility, or conduct of users",
    ],
  },
  {
    title: "11. Disputes",
    paragraphs: ["In case of disputes:"],
    bullets: [
      "Safarly may review transaction details",
      "Decisions made by Safarly are final for platform-level resolutions",
      "External legal action remains the responsibility of users",
    ],
  },
  {
    title: "12. Limitation of Liability",
    paragraphs: ["Safarly is not liable for:"],
    bullets: [
      "Loss, damage, or delay of items",
      "Personal injury or travel-related issues",
      "Actions of users on the platform",
    ],
  },
  {
    title: "13. Account Suspension",
    paragraphs: ["Safarly may suspend or terminate accounts for:"],
    bullets: [
      "Fraudulent activity",
      "Breaking our Community Standards (section 9)",
      "Other policy violations",
      "Safety concerns",
    ],
  },
  {
    title: "14. Changes",
    paragraphs: [
      "We may update these terms at any time. Continued use of the platform implies acceptance.",
    ],
  },
  {
    title: "15. Ownership & Company Information",
    paragraphs: [
      OWNERSHIP_STATEMENT_TERMS,
      `Questions about these Terms may be sent to ${SUPPORT_EMAIL}.`,
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    paragraphs: ["We may collect:"],
    bullets: [
      "Name, email, and phone number",
      "Profile photo, bio, and profile details such as language and travel preferences",
      "Pickup and handoff addresses",
      "Parcel details and photos, and trip details such as routes, dates and capacity",
      "Chat messages, and the photos and documents you attach to them",
      "For identity verification: photos of your government ID, the details read from it (such as your name, date of birth, nationality, document number and expiry date), a face scan and a face template made from it, and your IP address and device details at the time of the check",
      "Payment information processed through Stripe. Your card number is handled by Stripe and is not stored by Safarly",
      "Payout details: your bank account number, IFSC code or UPI ID for payouts in India through Razorpay, and the payout account status Stripe shares with us when you set up Stripe Connect",
      "Push notification tokens, so we can send notifications to your device",
      "Whether you are online or typing, which is shown to the person you are chatting with",
      "Reports you submit and users you block",
      "Usage data such as search activity and platform interactions",
    ],
  },
  {
    title: "2. How We Use Information",
    paragraphs: ["We use your data to:"],
    bullets: [
      "Facilitate connections between users",
      "Process payments and payouts",
      "Verify identity and prevent fraud, including stopping one person from opening several accounts",
      "Improve platform functionality",
    ],
  },
  {
    title: "3. Payment Data",
    paragraphs: [
      "Payments are processed securely through third-party providers (for example, Stripe). Safarly does not store full card details.",
    ],
  },
  {
    title: "4. Data Sharing",
    paragraphs: [
      "We do not sell your personal data, and we do not use it for advertising or tracking. We may share limited data:",
    ],
    bullets: [
      "Between users to enable transactions, such as your name, profile photo, listings and messages",
      "With Stripe, to process payments and Stripe Connect payouts",
      "With Razorpay, to send payouts in India",
      "With Supabase, which hosts our database, file storage and sign-in",
      "With Didit, our identity verification provider, which checks your ID and face scan for us and stores that data in the European Union",
      "With Expo, Apple and Google, to deliver push notifications",
      "With other service providers we rely on to run Safarly, such as email delivery, only as needed to provide the service",
      "When required by law",
    ],
  },
  {
    title: "5. Identity Verification and Biometric Data",
    paragraphs: [
      "We ask you to verify your identity before you can use features that involve payment and trust between users.",
      "How it works. Our identity verification provider, Didit, checks your government ID automatically, confirms that your face scan is of a real person who is present, and compares your face with the photo on your ID. To stop one person from opening several accounts, Didit also makes a face template (a set of measurements of your face) and compares it with other Safarly verifications. If the automatic check can't decide, a member of our team reviews the result. If automatic verification is ever unavailable, we may instead ask you to upload a photo of your ID and a selfie for our team to review.",
      "Biometric data. Your face scan and face template are biometric data. We collect them only after you give your written consent on the verification screen, and only to verify your identity and prevent fraud. We and Didit do not sell, lease or trade your biometric data, and do not use it for advertising, for training, or for any other purpose.",
      "Where it is processed. Didit acts as our processor, on our instructions, and processes and stores verification data in the European Union.",
      "How long we keep it. Your ID images, face scan, face template and the details read from your ID are permanently deleted within 180 days (about 6 months) of your verification, or sooner when you delete your account or ask us to. ID photos and selfies you upload for review by our team follow the same 180-day limit. We keep only the result of the check (verified or not, the reason, and the date) for as long as you have an account.",
      `Your choices. You can ask us to delete your verification data at ${SUPPORT_EMAIL}. Some features, such as paying for a delivery, need a verified identity, so you would need to verify again before using them.`,
    ],
  },
  {
    title: "6. Data Security",
    paragraphs: ["We implement all necessary safeguards to protect user data."],
  },
  {
    title: "7. User Control",
    paragraphs: ["You may:"],
    bullets: [
      "Update your profile",
      "Delete your account from within the app",
      "Contact us for data-related requests",
    ],
  },
  {
    title: "8. Data Retention & Deletion",
    paragraphs: [
      "We keep your account data for as long as your account is active.",
      "When you delete your account, your profile, trips, parcel requests and travel-buddy listings are removed, and your remaining personal details are deleted or anonymised. Deletion is permanent. Messages and reviews you exchanged stay visible to the other person, shown as \u201cDeleted user\u201d. Records the law requires us to keep, such as completed delivery, payment and tax records, are retained for as long as required.",
      "Identity-verification data (your ID images, face scan and face template) is deleted within 180 days of your verification, and straight away when you delete your account. We keep only the verification result while your account exists.",
    ],
  },
  {
    title: "9. Cookies & Tracking",
    paragraphs: [
      "Safarly does not set cookies and does not use analytics, advertising or tracking services. We store a small amount of information in your browser or app so you stay signed in and so one-time prompts are not repeated at you.",
      "Our Cookie Policy lists exactly what is stored and how to clear it.",
    ],
  },
  {
    title: "10. International Users",
    paragraphs: [
      "By using Safarly, you consent to data processing in the United States, in the European Union (for identity verification) and in other applicable regions.",
    ],
  },
  {
    title: "11. Changes",
    paragraphs: ["We may update this policy periodically."],
  },
  {
    title: "12. Contact",
    paragraphs: ["For questions or concerns: admin@mysafarly.com"],
  },
  {
    title: "13. Ownership & Company Information",
    paragraphs: [
      OWNERSHIP_STATEMENT,
      `${COMPANY_NAME} is the data controller responsible for personal information processed through Safarly.`,
    ],
  },
];

/** About screen — mirrors web `/about`. */
export const aboutSections: LegalSection[] = [
  {
    title: `What ${PLATFORM_NAME} is`,
    paragraphs: [
      `${PLATFORM_NAME} connects people who need to send something with travelers who are already going that way. Instead of paying international courier rates, a sender is matched with a verified traveler who has spare luggage capacity on the route.`,
      `${PLATFORM_NAME} also connects travelers looking for a companion on a shared journey.`,
    ],
  },
  {
    title: "Our mission",
    paragraphs: [
      "International shipping is expensive, slow and impersonal, while millions of travelers cross borders every day with unused luggage capacity. We exist to close that gap.",
      "Every delivery is verified, tracked through each stage of its journey, and paid through escrow that is only released once the receiver confirms delivery with a one-time code.",
    ],
  },
  {
    title: "How we keep it safe",
    bullets: [
      "Identity verification (KYC) before a user can carry or pay",
      "Payments held in escrow and released only on confirmed delivery",
      "A tracked journey with a record of every step",
      "A dispute process backed by human review",
    ],
  },
  {
    title: "Who operates Safarly",
    paragraphs: [
      OWNERSHIP_STATEMENT,
      COMPANY_BLURB,
      `${COMPANY_NAME}, ${COMPANY_JURISDICTION}.`,
    ],
  },
];

/** Contact screen — mirrors web `/contact`. */
export const contactSections: LegalSection[] = [
  {
    title: "Company information",
    paragraphs: [
      `Company: ${COMPANY_NAME}`,
      `Registration: ${COMPANY_JURISDICTION.replace(/^a /, "")}`,
      `Platform: ${PLATFORM_NAME}`,
      `Email: ${SUPPORT_EMAIL}`,
    ],
  },
  {
    title: "We'd love to hear from you",
    paragraphs: ["Reach out to the Safarly team about:"],
    bullets: [
      "General inquiries",
      "Support",
      "Partnership opportunities",
      "Feedback",
    ],
  },
];
