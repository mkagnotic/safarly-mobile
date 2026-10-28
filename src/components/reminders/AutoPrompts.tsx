import { useEffect, useRef, useState } from "react";

import { KycPromptDialog } from "@/components/kyc/KycPromptDialog";
import { RateDeliveryPrompt } from "@/components/reviews/RateDeliveryPrompt";
import { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { useMyNotifications } from "@/hooks/api/useMyNotifications";
import { navigationRef } from "@/navigation/navigationRef";
import { navigateToNotificationTarget } from "@/services/notifications/push";
import { freshMatchIds, MATCH_PROMPT_COPY } from "@/services/notifications/matchPromptRules";
import { loadPrompted, rememberPrompted } from "@/services/notifications/matchPrompted";
import { useAppStore } from "@/store/useAppStore";
import { heldPrompts, isPromptSuppressedRoute } from "./autoPromptRules";
import { JourneyExpiryReminder } from "./JourneyExpiryReminder";

/** A little longer than RN's Modal fade, so the next popup presents after the last has gone. */
const RELEASE_DELAY_MS = 500;

/** True while `active`, and for a short while after it turns false. */
function useHeldBy(active: boolean): boolean {
  const [held, setHeld] = useState(active);
  useEffect(() => {
    if (active) {
      setHeld(true);
      return;
    }
    const t = setTimeout(() => setHeld(false), RELEASE_DELAY_MS);
    return () => clearTimeout(t);
  }, [active]);
  return held;
}

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
 * One-time identity-check welcome after a fresh registration (store flag set by
 * sign-up). Consumed only when it can actually show, so a form or another popup
 * on screen doesn't lose it. Used to live on Home, outside the coordinator, so
 * iOS could drop it or the other popup (29 Oct 2026).
 */
function KycWelcomePrompt({ held, onActiveChange }: { held: boolean; onActiveChange: (active: boolean) => void }) {
  const kycWelcomePending = useAppStore((s) => s.kycWelcomePending);
  const setKycWelcomePending = useAppStore((s) => s.setKycWelcomePending);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (held || open || !kycWelcomePending) return;
    setKycWelcomePending(false);
    setOpen(true);
  }, [held, open, kycWelcomePending, setKycWelcomePending]);
  useEffect(() => {
    onActiveChange(open);
  }, [open, onActiveChange]);
  return (
    <KycPromptDialog
      open={open}
      variant="welcome"
      onClose={() => setOpen(false)}
      onVerify={() => {
        setOpen(false);
        navigateToNotificationTarget({ screen: "KycVerificationTab" });
      }}
    />
  );
}

/**
 * Route-match catch-up banner (web useMatchPrompt): ONE banner for matches the
 * user has not been told about yet (the live banner remembers its own, so it
 * is never repeated). Waits while a popup has the screen.
 */
function useMatchCatchUp(
  notifications: readonly { id: string; read?: boolean; data?: unknown }[],
  loading: boolean,
  held: boolean,
) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const shownRef = useRef(false);
  useEffect(() => {
    if (!userId || loading || held || shownRef.current) return;
    const list = notifications as { id: string; read?: boolean; data?: { kind?: string } | null }[];
    let cancelled = false;
    void (async () => {
      const prompted = await loadPrompted(userId);
      const fresh = freshMatchIds(list, prompted);
      if (cancelled || fresh.length === 0 || shownRef.current) return;
      shownRef.current = true;
      await rememberPrompted(userId, fresh);
      showToast({
        title: MATCH_PROMPT_COPY.title,
        message: MATCH_PROMPT_COPY.message,
        variant: "info",
        duration: 8000,
        onPress: () => navigateToNotificationTarget({ screen: "Trips" }),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, notifications, loading, held]);
}

/**
 * The app-wide popups that open on their own after data loads: KYC welcome,
 * journey reminder, rate delivery. One at a time (autoPromptRules: whichever
 * shows first keeps the screen; the others wait - iOS silently drops a second
 * Modal), and never over a form, checkout or the identity check. Same
 * coordinator and screen list as web's AutoPrompts.
 */
export function AutoPrompts() {
  const activeRoute = useActiveRouteName();
  const suppressed = isPromptSuppressedRoute(activeRoute);
  // One notifications request for the reminder and the match catch-up.
  const { notifications, loading } = useMyNotifications({ perPage: 50 });
  const [kycOpen, setKycOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const [rateOpen, setRateOpen] = useState(false);
  const held = heldPrompts({ kycWelcome: kycOpen, reminder: reminderOpen, rate: rateOpen });
  const kycHeld = useHeldBy(held.kycWelcome);
  const reminderHeld = useHeldBy(held.reminder);
  const rateHeld = useHeldBy(held.rate);
  const anyOpen = useHeldBy(kycOpen || reminderOpen || rateOpen);

  useMatchCatchUp(notifications, loading, anyOpen || suppressed);

  return (
    <>
      <KycWelcomePrompt held={kycHeld || suppressed} onActiveChange={setKycOpen} />
      <JourneyExpiryReminder
        notifications={notifications}
        loading={loading}
        held={reminderHeld || suppressed}
        onActiveChange={setReminderOpen}
      />
      <RateDeliveryPrompt held={rateHeld || suppressed} onActiveChange={setRateOpen} />
    </>
  );
}
