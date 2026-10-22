/**
 * Identity verification with Didit on mobile — the decisions, as pure functions
 * so they are unit-tested (kycFlow.test.ts). Same rules and copy as web
 * (src/features/profile/components/DiditKycPanel.tsx + src/hooks/api/useKyc.ts).
 * The server decides the state; the app only starts/continues and reads status.
 */
import type { KycConsentState, KycStatusBlock } from "@/services/api";

/** The return link Didit opens when the user finishes (server-side allowlist). */
export const KYC_RETURN_URL = "safarly://kyc-return";

/** Only ever open Didit's hosted flow, whatever the server sent. */
export const DIDIT_HOSTED_PREFIX = "https://verify.didit.me/";
export function isDiditUrl(url: unknown): url is string {
  return typeof url === "string" && url.startsWith(DIDIT_HOSTED_PREFIX);
}

/**
 * Which flow the screen shows.
 *  - "manual": the provider switch is "manual" (or an older server): today's wizard, untouched.
 *  - "didit": automatic verification.
 *  - "manual-fallback": Didit is chosen but unreachable and the server still
 *    accepts uploads (kyc_provider.manual_upload): today's wizard plus a notice.
 */
export type KycMode = "manual" | "didit" | "manual-fallback";

export function kycMode(block: KycStatusBlock | null | undefined, diditDown: boolean): KycMode {
  if (block?.provider !== "didit") return "manual";
  if (block.manual_upload && (!block.available || diditDown)) return "manual-fallback";
  return "didit";
}

// Same cadence as web: 5 s for 2 minutes, then 15 s, stop after 30 minutes.
const FAST_POLL_MS = 5_000;
const SLOW_POLL_MS = 15_000;
const FAST_WINDOW_MS = 2 * 60_000;
const STOP_AFTER_MS = 30 * 60_000;

/** Polling cadence while a verification is in progress. false = don't poll. */
export function kycPollInterval(block: Pick<KycStatusBlock, "provider" | "state" | "session_started_at"> | null | undefined, now = Date.now()): number | false {
  if (block?.provider !== "didit" || block.state !== "in_progress") return false;
  const started = block.session_started_at ? new Date(block.session_started_at).getTime() : now;
  const age = now - started;
  if (age >= STOP_AFTER_MS) return false;
  return age < FAST_WINDOW_MS ? FAST_POLL_MS : SLOW_POLL_MS;
}

export const DIDIT_COPY = {
  verifiedTitle: "Identity Verified",
  verifiedDesc: "Your identity has been verified. You have full access to all features.",
  reviewTitle: "Under Review",
  reviewDesc: "Our team is reviewing your verification. We'll let you know as soon as it's done.",
  actionTitle: "Action needed",
  declinedFallback: "We couldn't verify your identity. Please make sure your ID is valid and clearly visible, then try again.",
  exhausted: "Our team will review your verification and contact you.",
  progressTitle: "Verification in progress",
  progressDesc: "Finish the steps on Didit's secure page. This page updates by itself when you're done.",
  progressHint: "Closed the page by mistake? Continue where you left off below.",
  unavailableTitle: "Verification is temporarily unavailable",
  unavailable: "Please try again in a few minutes.",
  opening: "Opening secure verification…",
  fallbackNotice: "Automatic verification is unavailable right now, so you can upload your documents for our team to review instead.",
  beforeYouStart: [
    "Have your passport, national ID, driver's license or residence permit ready.",
    "You'll take a short face scan with your camera. It takes about 2 minutes.",
    "Use good light and remove anything covering your face.",
  ],
} as const;

export type DiditView =
  | { kind: "approved" }
  | { kind: "in_review" }
  | { kind: "exhausted"; reason: string; contactEmail: string | null }
  | { kind: "unavailable" }
  | { kind: "consent" }
  | { kind: "not_started" }
  | { kind: "in_progress"; canCheck: true }
  | { kind: "declined"; reason: string; attemptsLeft: number };

/**
 * What the Didit panel shows. `consentAgreed` is true right after "I agree"
 * succeeded, so the consent step doesn't flash back while the refetch lands.
 */
export function diditView(
  block: KycStatusBlock,
  consent: KycConsentState | null | undefined,
  opts: { unavailable?: boolean; consentAgreed?: boolean } = {},
): DiditView {
  if (block.state === "approved") return { kind: "approved" };
  if (block.state === "in_review") return { kind: "in_review" };
  if (block.state === "attempts_exhausted") {
    return { kind: "exhausted", reason: block.reason ?? DIDIT_COPY.exhausted, contactEmail: consent?.contact_email ?? null };
  }
  if (!block.available || opts.unavailable) return { kind: "unavailable" };
  const needsConsent = (block.consent_required || !!consent?.required) && !opts.consentAgreed;
  if (needsConsent) {
    const ready = !!(consent?.policy_version && consent.retention_days && consent.contact_email);
    return ready ? { kind: "consent" } : { kind: "unavailable" };
  }
  if (block.state === "in_progress") return { kind: "in_progress", canCheck: true };
  if (block.state === "declined") {
    return { kind: "declined", reason: block.reason ?? DIDIT_COPY.declinedFallback, attemptsLeft: block.attempts_left };
  }
  return { kind: "not_started" };
}

export function attemptsLeftText(n: number): string {
  return n === 1 ? "You have 1 attempt left." : `You have ${n} attempts left.`;
}

/** Start-button label for the state the user is in (same as web). */
export function startLabel(kind: DiditView["kind"]): string {
  return kind === "in_progress" ? "Continue verification" : kind === "declined" ? "Try again" : "Start verification";
}

/** How an /initiate error is handled. Same mapping as web. */
export type InitiateErrorAction = "unavailable" | "refresh" | "message";
export function initiateErrorAction(err: { code?: string; status?: number } | null | undefined): InitiateErrorAction {
  const code = err?.code ?? "";
  if (code === "KYC_PROVIDER_UNAVAILABLE" || code === "KYC_PROVIDER_DISABLED" || (err?.status ?? 0) >= 500) return "unavailable";
  if (code === "KYC_CONSENT_REQUIRED" || code === "KYC_ATTEMPTS_EXHAUSTED" || code === "CONFLICT") return "refresh";
  return "message";
}

/**
 * What to tell someone who tapped "Check status" (pure, tested; same on web).
 *
 * Client, 22 Oct 2026: the button re-read the same screen and appeared to do
 * nothing. The server now asks Didit on a tap (`?check=1`) and says what it
 * found; this puts that into words. null = the screen itself moved on
 * (verified / under review / declined), which says it better than a note.
 */
export type KycCheckNote = { tone: "info" | "warning"; text: string };
export function statusCheckMessage(
  kyc: { state?: string; check?: { result: string } | null } | null | undefined,
): KycCheckNote | null {
  if (!kyc || kyc.state !== "in_progress") return null;
  switch (kyc.check?.result) {
    case "asked":
      return {
        tone: "info",
        text: "You haven't finished verification yet. Tap \"Continue verification\" to pick up where you left off. Your result appears here as soon as you're done.",
      };
    case "unreachable":
      return { tone: "warning", text: "We couldn't reach the verification service just now. Please try again in a minute." };
    case "too_soon":
      return { tone: "info", text: "We just checked. Give it a few seconds and try again." };
    default:
      return {
        tone: "info",
        text: "No result yet. If you've just finished the face scan it can take a minute to arrive, and this page updates on its own.",
      };
  }
}
