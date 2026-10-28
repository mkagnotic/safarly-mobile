/**
 * The popups that open on their own (KYC welcome, journey reminder, rate
 * delivery). Pure, so it is unit-tested without React Native; the same rules
 * live on web (src/lib/autoPrompts.ts) - keep them in step (29 Oct 2026).
 *
 * One at a time: iOS presents one Modal at a time and silently drops a second.
 * Whichever is showing keeps the screen; the others wait until it has closed.
 * If two want the screen in the same moment, the earlier one in
 * AUTO_PROMPT_ORDER wins.
 */
export type AutoPromptKey = "kycWelcome" | "reminder" | "rate";

export const AUTO_PROMPT_ORDER: readonly AutoPromptKey[] = ["kycWelcome", "reminder", "rate"];

/**
 * Which prompts must wait, given which are showing. A showing prompt is held
 * only by an earlier-ranked one that is also showing (the tie-break); a prompt
 * that is not showing is held by any prompt that is.
 */
export function heldPrompts(active: Partial<Record<AutoPromptKey, boolean>>): Record<AutoPromptKey, boolean> {
  const rank = (k: AutoPromptKey) => AUTO_PROMPT_ORDER.indexOf(k);
  const out = {} as Record<AutoPromptKey, boolean>;
  for (const k of AUTO_PROMPT_ORDER) {
    out[k] = AUTO_PROMPT_ORDER.some(
      (other) => other !== k && !!active[other] && (rank(other) < rank(k) || !active[k]),
    );
  }
  return out;
}

/**
 * Screens where an interrupting popup would get in the way of an active task -
 * web's list (pay, rate, onboarding, payout setup, KYC, send parcel, list trip,
 * create buddy) mapped to the app's routes. A modal over a half-filled form
 * swallows the taps meant for it.
 */
export const PROMPT_SUPPRESSED_ROUTES: ReadonlySet<string> = new Set([
  "PayBookingTab",
  "DeliveryReviewTab",
  "ProfileSetup",
  "PayoutSetupTab",
  "KycVerification",
  "KycVerificationTab",
  "SendParcel",
  "SendParcelTab",
  "ListTrip",
  "ListTripTab",
  "CreateBuddyTab",
]);

export function isPromptSuppressedRoute(name: string | undefined | null): boolean {
  return !!name && PROMPT_SUPPRESSED_ROUTES.has(name);
}
