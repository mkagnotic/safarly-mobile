/**
 * Has this account finished onboarding? Three answers, not two.
 *
 * The old check returned a boolean, so ANY failure to load the profile (a
 * timeout, a 5xx, an expired session the refresh could not rescue) read as
 * "not onboarded" and dropped an existing user onto the ProfileSetup / Terms
 * screen. Only the server saying `terms_accepted_at` is empty may send someone
 * there; when the profile cannot be read, the answer is "unknown" and the app
 * shows an error with Try again instead. Same rule as web's CustomerLayout gate.
 *
 * Two failures can never succeed on a retry, so they are terminal instead of
 * "unknown": the session is no longer accepted (401 / UNAUTHENTICATED after the
 * client's own refresh-and-retry) -> "signedOut", and the server saying the
 * account was deleted -> "deleted". Without this the user tapped Try again
 * forever, and relaunching restored the same dead session.
 *
 * Kept free of app imports so the node test runner can exercise it directly.
 */

export type OnboardingStatus = "complete" | "incomplete" | "unknown" | "signedOut" | "deleted";

export interface OnboardingResult {
  status: OnboardingStatus;
  /** Why the profile could not be read (statuses other than complete/incomplete). */
  error?: unknown;
}

interface Options {
  /** True for the API client's own deadline: retrying it would add another 45s. */
  isTimeout: (error: unknown) => boolean;
  /** The session is no longer accepted (401 / UNAUTHENTICATED). Terminal. */
  isUnauthenticated?: (error: unknown) => boolean;
  /** The server says this account was deleted. Terminal; checked first. */
  isDeleted?: (error: unknown) => boolean;
  /** Pause before the single retry of a transient failure. */
  retryDelayMs?: number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * `loadTermsAcceptedAt` resolves to the profile's `terms_accepted_at`
 * (null/undefined for a genuinely new account) or rejects when the profile
 * could not be read.
 *
 * A transient failure is retried ONCE: the request runs right after sign-in,
 * exactly when a cold radio or a just-refreshed token makes a blip likely.
 * Our own timeout is not retried.
 */
export async function checkOnboarding(
  loadTermsAcceptedAt: () => Promise<string | null | undefined>,
  { isTimeout, isUnauthenticated, isDeleted, retryDelayMs = 600, sleep = defaultSleep }: Options,
): Promise<OnboardingResult> {
  let lastError: unknown;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const acceptedAt = await loadTermsAcceptedAt();
      return { status: acceptedAt ? "complete" : "incomplete" };
    } catch (error) {
      lastError = error;
      if (isDeleted?.(error)) return { status: "deleted", error };
      if (isUnauthenticated?.(error)) return { status: "signedOut", error };
      if (isTimeout(error)) break;
      if (attempt === 0) await sleep(retryDelayMs);
    }
  }
  return { status: "unknown", error: lastError };
}
