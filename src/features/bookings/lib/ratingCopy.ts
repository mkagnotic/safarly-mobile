/**
 * One wording + rule set for rating a delivery: the Rate delivery screen, the
 * auto prompt (RateDeliverySheet) and Delivery details read from here. Web's
 * src/features/bookings/lib/ratingCopy.ts carries the same strings (same words
 * on web, Android and iOS). Pure - no React Native imports - so node:test can
 * load it.
 */
export const SCORE_LABELS: Record<number, string> = {
  1: "Poor",
  2: "Fair",
  3: "Good",
  4: "Very good",
  5: "Excellent",
};

/** The server refuses longer reviews ("Review must be 500 characters or fewer."). */
export const REVIEW_MAX = 500;

export const RATING_COPY = {
  title: "Rate delivery",
  question: (name: string) => `How was your experience with ${name}?`,
  tapHint: "Tap a star to rate",
  reviewLabel: "Review (optional)",
  reviewPlaceholder: "Share your experience…",
  submit: "Submit rating",
  submitting: "Submitting…",
  later: "Later",
  notDelivered: "You can rate this delivery once it's delivered.",
  successTitle: "Rating submitted",
  successBody: "Thanks for your feedback!",
  errorTitle: "Couldn't submit rating",
} as const;

/** The other party's role, as the viewer sees it (client rule party-label-receiver). */
export function counterpartRoleLabel(viewerIsSender: boolean): "Carrier" | "Receiver" {
  return viewerIsSender ? "Carrier" : "Receiver";
}

/** Ratings open only once the parcel is delivered - the server refuses anything else. */
export function canRateBooking(status: string | null | undefined): boolean {
  return status === "delivered";
}

/**
 * CONFLICT = "Already rated this booking" (rated on another device, or a double
 * tap). That is the rated state, not a failure: close, refresh, no error toast.
 * Duck-typed on `code` so this file stays free of the API client.
 */
export function isAlreadyRatedError(error: unknown): boolean {
  return typeof error === "object" && error !== null && (error as { code?: unknown }).code === "CONFLICT";
}

/** "★ 4.8" for a real rating; null when there is none yet (0 means unrated). */
export function formatRating(rating: number | null | undefined): string | null {
  if (rating == null || !Number.isFinite(Number(rating)) || Number(rating) <= 0) return null;
  return `★ ${Number(rating).toFixed(1)}`;
}
