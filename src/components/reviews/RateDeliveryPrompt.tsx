import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useBookings } from "@/hooks/api/useBookings";
import { getErrorMessage, ratingsApi } from "@/services/api";
import { RateDeliverySheet, type RateDeliveryValues } from "./RateDeliverySheet";
import { RATING_COPY, counterpartRoleLabel, isAlreadyRatedError } from "@/features/bookings/lib/ratingCopy";

/**
 * Auto-opens the delivery-rating prompt for the first delivered booking the
 * signed-in user hasn't rated yet — web parity with `RateDeliveryPrompt`.
 * Mounted once for the authenticated app (see RootNavigator).
 *
 * `viewer_has_rated` comes from the bookings API, so a rated booking never
 * prompts again; the backend allows one rating per person per booking, so both
 * sides get asked independently. "Later" dismissals are kept in memory only, so
 * an un-acted prompt returns next launch — enough to ask again, not to nag.
 */
export function RateDeliveryPrompt({
  held = false,
  onActiveChange,
}: {
  /** Another app-wide popup or a form is showing; wait (iOS can present one Modal at a time).
   *  AutoPrompts owns the "don't interrupt" screen list (autoPromptRules). */
  held?: boolean;
  onActiveChange?: (active: boolean) => void;
} = {}) {
  const { user } = useAuth();
  const { bookings, refetch } = useBookings({ status: "delivered", perPage: 10 });

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const pending = useMemo(() => {
    if (!user || held) return null;
    return bookings.find((b) => !b.viewer_has_rated && !dismissed.includes(b.id)) ?? null;
  }, [bookings, user, held, dismissed]);

  useEffect(() => {
    setOpen(pending != null);
  }, [pending]);

  useEffect(() => {
    onActiveChange?.(open);
  }, [open, onActiveChange]);

  const { ratedUserId, ratedUserName, ratedUser, roleLabel, routeSummary } = useMemo(() => {
    if (!pending || !user) {
      return {
        ratedUserId: null as string | null,
        ratedUserName: "your delivery partner",
        ratedUser: null,
        roleLabel: null as string | null,
        routeSummary: null as string | null,
      };
    }
    const viewerIsSender = pending.sender_id === user.id;
    const parcel = pending.parcel;
    return {
      ratedUserId: viewerIsSender ? pending.carrier_id : pending.sender_id,
      ratedUserName: viewerIsSender
        ? pending.carrier?.name ?? "Carrier"
        : pending.sender?.name ?? "Receiver",
      ratedUser: (viewerIsSender ? pending.carrier : pending.sender) ?? null,
      roleLabel: counterpartRoleLabel(viewerIsSender),
      routeSummary: parcel?.from_city && parcel?.to_city ? `${parcel.from_city} → ${parcel.to_city}` : null,
    };
  }, [pending, user]);

  const handleDismiss = useCallback(() => {
    if (pending) setDismissed((prev) => (prev.includes(pending.id) ? prev : [...prev, pending.id]));
    setOpen(false);
  }, [pending]);

  const handleSubmit = useCallback(
    async ({ score, review }: RateDeliveryValues) => {
      if (!pending || !ratedUserId || score <= 0 || submitting) return;
      setSubmitting(true);
      try {
        await ratingsApi.rateDelivery({
          booking_id: pending.id,
          rated_user_id: ratedUserId,
          score,
          review: review || undefined,
        });
        // Stop this booking re-prompting immediately, then refetch so
        // `viewer_has_rated` flips and the next unrated delivery can take its turn.
        setDismissed((prev) => (prev.includes(pending.id) ? prev : [...prev, pending.id]));
        setOpen(false);
        showToast({ title: RATING_COPY.successTitle, message: RATING_COPY.successBody, variant: "success" });
        await refetch();
      } catch (err) {
        // Already rated (another device, a double tap): that IS the rated
        // state. Close, refresh, and don't call it a failure.
        if (isAlreadyRatedError(err)) {
          setDismissed((prev) => (prev.includes(pending.id) ? prev : [...prev, pending.id]));
          setOpen(false);
          void refetch();
          return;
        }
        showToast({ title: RATING_COPY.errorTitle, message: getErrorMessage(err), variant: "error" });
      } finally {
        setSubmitting(false);
      }
    },
    [pending, ratedUserId, submitting, refetch],
  );

  if (!pending) return null;

  return (
    <RateDeliverySheet
      open={open}
      ratedUserName={ratedUserName}
      ratedUserAvatarUrl={ratedUser?.avatar_url ?? null}
      ratedUserVerified={ratedUser?.is_verified === true}
      roleLabel={roleLabel}
      routeSummary={routeSummary}
      pending={submitting}
      onDismiss={handleDismiss}
      onSubmit={handleSubmit}
    />
  );
}
