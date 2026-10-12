import { useEffect, useState } from "react";

import { RateDeliveryPrompt } from "@/components/reviews/RateDeliveryPrompt";
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
 * The app-wide popups that open on their own after data loads. iOS presents one
 * Modal at a time and silently drops a second, so whichever opens first holds
 * the other back until it has closed.
 */
export function AutoPrompts() {
  const [rateOpen, setRateOpen] = useState(false);
  const [reminderOpen, setReminderOpen] = useState(false);
  const rateHeld = useHeldBy(reminderOpen);
  // Tie-break: if both open in the same moment, the reminder keeps the screen
  // and the rating prompt waits — otherwise each would hold the other and they
  // would release, collide and re-hold every half second.
  const reminderHeld = useHeldBy(rateOpen && !reminderOpen);

  return (
    <>
      <RateDeliveryPrompt held={rateHeld} onActiveChange={setRateOpen} />
      <JourneyExpiryReminder held={reminderHeld} onActiveChange={setReminderOpen} />
    </>
  );
}
