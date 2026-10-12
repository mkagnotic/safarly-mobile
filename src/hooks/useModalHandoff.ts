import { useCallback, useEffect, useRef } from "react";
import { Platform } from "react-native";

/**
 * How long to wait on iOS when the closing Modal's `onDismiss` never fires —
 * a little longer than RN's fade animation (~300 ms).
 */
const IOS_DISMISS_FALLBACK_MS = 450;

/**
 * Close one Modal, then open the next surface (another Modal, an alert, or a
 * native picker) — safely on iOS.
 *
 * UIKit presents one view controller at a time. Presenting while a Modal is
 * still fading out is refused ("Attempt to present … while a presentation is in
 * progress"), and RN does not retry, so on iPhone the second surface silently
 * never appears. Android has no such limit and runs `next` immediately.
 *
 * On iOS `next` runs from the closing Modal's `onDismiss` (wire the returned
 * `onDismiss` to it) or after a fallback delay, whichever comes first, so it is
 * still safe for Modals that live in child components.
 */
export function useModalHandoff() {
  const pending = useRef<(() => void) | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const onDismiss = useCallback(() => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    const next = pending.current;
    pending.current = null;
    next?.();
  }, []);

  const after = useCallback(
    (close: () => void, next: () => void) => {
      close();
      if (Platform.OS !== "ios") {
        next();
        return;
      }
      if (timer.current) clearTimeout(timer.current);
      pending.current = next;
      timer.current = setTimeout(onDismiss, IOS_DISMISS_FALLBACK_MS);
    },
    [onDismiss],
  );

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      pending.current = null;
    },
    [],
  );

  return { after, onDismiss };
}
