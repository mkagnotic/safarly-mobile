import type { Ionicons } from "@expo/vector-icons";

// The KYC prompt's words, as data so they are unit-tested (kycPromptCopy.test.ts).
// Same three sets as web (src/features/profile/components/KycPromptDialog.tsx),
// plus web's Didit "under review" copy: Didit never promises "1–2 business days".

export type KycPromptVariant = "welcome" | "payment";

export interface Copy {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  dismiss: string;
}

export function resolveCopy(variant: KycPromptVariant, pending: boolean, provider: "manual" | "didit" = "manual"): Copy {
  if (variant === "welcome") {
    return {
      icon: "shield-checkmark-outline",
      title: "Verify your identity",
      body: "Complete a quick identity check to send parcels and make secure payments. It only takes a minute.",
      cta: "Verify now",
      dismiss: "Maybe later",
    };
  }
  if (pending && provider === "didit") {
    return {
      icon: "time-outline",
      title: "Verification under review",
      body: "Our team is reviewing your verification. You'll be able to pay once it's approved, and we'll let you know as soon as it's done.",
      cta: "View status",
      dismiss: "Close",
    };
  }
  if (pending) {
    return {
      icon: "time-outline",
      title: "Verification under review",
      body: "Your identity is still being reviewed. You'll be able to pay once it's approved — usually within 1–2 business days.",
      cta: "View status",
      dismiss: "Close",
    };
  }
  return {
    icon: "shield-half-outline",
    title: "Verification required",
    body: "For your security, please complete identity verification before making a payment.",
    cta: "Complete verification",
    dismiss: "Not now",
  };
}
