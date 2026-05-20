export type LegalSection = {
  title: string;
  paragraphs?: string[];
  bullets?: string[];
};

export const LEGAL_EFFECTIVE_DATE = "App Launch Date";

export const termsSections: LegalSection[] = [
  {
    title: "1. Overview",
    paragraphs: [
      "Safarly is a platform that connects individuals who need to send items with travelers willing to carry them, and also enables travel companionship between users.",
      "Safarly does not physically handle, transport, or store any items.",
    ],
  },
  {
    title: "2. User Roles",
    paragraphs: ["Users may act as:"],
    bullets: [
      "Carrier (Traveler): transports items",
      "Receiver: requests delivery",
      "Travel Buddy: connects for shared travel",
      "Users are solely responsible for their interactions and arrangements.",
    ],
  },
  {
    title: "3. Platform Role",
    paragraphs: ["Safarly:"],
    bullets: [
      "Facilitates connections between users",
      "Processes payments via a third-party provider (for example, Stripe)",
      "Holds funds temporarily until delivery confirmation",
      "Does not guarantee delivery, quality, or safety of items or travel experience",
    ],
  },
  {
    title: "4. Payments & Fees",
    bullets: [
      "Payments are processed through secure third-party providers",
      "Safarly charges a platform fee per transaction",
      "Funds are held and released upon delivery confirmation",
      "Users agree to applicable fees and pricing at the time of booking",
    ],
  },
  {
    title: "5. Refunds & Cancellations",
    bullets: [
      "Full refunds may be issued before a match is confirmed",
      "Partial refunds may apply after a match is confirmed",
      "No refunds once delivery is in progress, except in case of disputes",
    ],
  },
  {
    title: "6. User Responsibilities",
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
    title: "7. Prohibited Items",
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
    title: "8. Travel Companion Disclaimer",
    paragraphs: ["Safarly facilitates introductions only. Users are responsible for:"],
    bullets: [
      "Verifying identity and comfort level",
      "Making independent decisions regarding travel companionship",
      "Safarly does not guarantee safety, compatibility, or conduct of users",
    ],
  },
  {
    title: "9. Disputes",
    paragraphs: ["In case of disputes:"],
    bullets: [
      "Safarly may review transaction details",
      "Decisions made by Safarly are final for platform-level resolutions",
      "External legal action remains the responsibility of users",
    ],
  },
  {
    title: "10. Limitation of Liability",
    paragraphs: ["Safarly is not liable for:"],
    bullets: [
      "Loss, damage, or delay of items",
      "Personal injury or travel-related issues",
      "Actions of users on the platform",
    ],
  },
  {
    title: "11. Account Suspension",
    paragraphs: ["Safarly may suspend or terminate accounts for:"],
    bullets: ["Fraudulent activity", "Policy violations", "Safety concerns"],
  },
  {
    title: "12. Changes",
    paragraphs: [
      "We may update these terms at any time. Continued use of the platform implies acceptance.",
    ],
  },
];

export const privacySections: LegalSection[] = [
  {
    title: "1. Information We Collect",
    paragraphs: ["We may collect:"],
    bullets: [
      "Name, email, and phone number",
      "Profile details such as language and travel preferences",
      "Government ID for verification/KYC",
      "Payment information processed through Stripe",
      "Usage data such as search activity, chats, and platform interactions",
    ],
  },
  {
    title: "2. How We Use Information",
    paragraphs: ["We use your data to:"],
    bullets: [
      "Facilitate connections between users",
      "Process payments and payouts",
      "Verify identity and prevent fraud",
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
    paragraphs: ["We may share limited data:"],
    bullets: [
      "Between users to enable transactions",
      "With service providers for payment and verification",
      "When required by law",
    ],
  },
  {
    title: "5. Data Security",
    paragraphs: ["We implement all necessary safeguards to protect user data."],
  },
  {
    title: "6. User Control",
    paragraphs: ["You may:"],
    bullets: [
      "Update your profile",
      "Request account deletion",
      "Contact us for data-related requests",
    ],
  },
  {
    title: "7. Cookies & Tracking",
    paragraphs: ["We may use cookies to:"],
    bullets: ["Improve user experience", "Analyze usage"],
  },
  {
    title: "8. International Users",
    paragraphs: [
      "By using Safarly, you consent to data processing in the United States and other applicable regions.",
    ],
  },
  {
    title: "9. Changes",
    paragraphs: ["We may update this policy periodically."],
  },
  {
    title: "10. Contact",
    paragraphs: ["For questions or concerns: admin@mysafarly.com"],
  },
];
