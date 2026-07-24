import { useCallback, useEffect, useMemo, useState } from "react";

import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useBookings } from "@/hooks/api/useBookings";
import { navigationRef } from "@/navigation/navigationRef";
import { getErrorMessage, ratingsApi } from "@/services/api";
import { RateDeliverySheet, type RateDeliveryValues } from "./RateDeliverySheet";

// Screens where an interrupting popup would get in the way of an active task —
// mirrors web's SUPPRESSED route list (pay / rate / payment result). Onboarding
// and profile-setup are already excluded by the mount gate in RootNavigator.
const SUPPRESSED_ROUTES = new Set<string>([
  "PayBookingTab",
  "ReviewPayTab",
  "PaymentSuccessTab",
  "PaymentFailureTab",
  "DeliveryReviewTab",
  "KycVerification",
  "KycVerificationTab",
]);

/**
 * Reactive active-route name via the container ref. We're mounted as a sibling
 * of the navigator (not inside it), so `useNavigationState` isn't available —
 * `navigationRef.getCurrentRoute()` returns the deepest focused route instead.
 */
function useActiveRouteName(): string | undefined {
  const [name, setName] = useState<string | undefined>(() =>
    navigationRef.isReady() ? navigationRef.getCurrentRoute()?.name : undefined,
  );
  useEffect(() => {
    const update = () => setName(navigationRef.getCurrentRoute()?.name);
    update();
    const unsub = navigationRef.addListener("state", update);
    return unsub;
  }, []);
  return name;
}

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
export function RateDeliveryPrompt() {
  const { user } = useAuth();
  const { bookings, refetch } = useBookings({ status: "delivered", perPage: 10 });

  const [dismissed, setDismissed] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const activeRoute = useActiveRouteName();
  const suppressed = activeRoute ? SUPPRESSED_ROUTES.has(activeRoute) : false;

  const pending = useMemo(() => {
    if (!user || suppressed) return null;
    return bookings.find((b) => !b.viewer_has_rated && !dismissed.includes(b.id)) ?? null;
  }, [bookings, user, suppressed, dismissed]);

  useEffect(() => {
    setOpen(pending != null);
  }, [pending]);

  const { ratedUserId, ratedUserName, routeSummary } = useMemo(() => {
    if (!pending || !user) {
      return { ratedUserId: null as string | null, ratedUserName: "your delivery partner", routeSummary: null as string | null };
    }
    const viewerIsSender = pending.sender_id === user.id;
    const parcel = pending.parcel;
    return {
      ratedUserId: viewerIsSender ? pending.carrier_id : pending.sender_id,
      ratedUserName: viewerIsSender
        ? pending.carrier?.name ?? "Carrier"
        : pending.sender?.name ?? "Sender",
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
        showToast({ title: "Rating submitted", message: "Thanks for your feedback!", variant: "success" });
        await refetch();
      } catch (err) {
        showToast({ title: "Couldn't submit rating", message: getErrorMessage(err), variant: "error" });
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
      routeSummary={routeSummary}
      pending={submitting}
      onDismiss={handleDismiss}
      onSubmit={handleSubmit}
    />
  );
}
