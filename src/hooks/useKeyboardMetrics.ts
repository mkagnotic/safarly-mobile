import { useEffect, useState } from "react";
import { Dimensions, Keyboard, Platform, type KeyboardEvent } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

/** Android fires no `will` events, so there is no system duration to follow. */
const ANDROID_ANIMATION_MS = 160;

export interface KeyboardMetrics {
  /** True while the software keyboard is on screen. */
  visible: boolean;
  /**
   * How far the keyboard reaches up from the physical bottom of the screen —
   * the distance an edge-to-edge surface must lift to sit on top of it.
   */
  screenOverlap: number;
  /** Duration of the system keyboard animation, to move in step with it. */
  animationDuration: number;
}

/**
 * The one place the app reads the software keyboard. Everything that has to
 * stay above it — bottom sheets, the chat composer — derives its layout from
 * this, so the platform quirks below are handled once.
 *
 * - iOS fires `will` events early enough to animate alongside the keyboard.
 *   `keyboardWillChangeFrame` also fires while the keyboard is leaving, still
 *   carrying its old height, so the overlap is taken from where the keyboard's
 *   top edge lands (`screenY`) rather than from `height`.
 * - Android reports the height with the navigation bar already subtracted
 *   (`imeInsets.bottom - systemBars.bottom` in ReactRootView), yet Expo's
 *   edge-to-edge surfaces run down behind that bar. So the bar is added back;
 *   leaving it out stops every lifted surface one navigation bar short, where
 *   the keyboard's suggestion strip clips it.
 */
export function useKeyboardMetrics(): KeyboardMetrics {
  const { bottom: bottomInset } = useSafeAreaInsets();
  const [state, setState] = useState<{ height: number; duration: number }>({
    height: 0,
    duration: ANDROID_ANIMATION_MS,
  });

  useEffect(() => {
    const ios = Platform.OS === "ios";
    const showEvent = ios ? "keyboardWillChangeFrame" : "keyboardDidShow";
    const hideEvent = ios ? "keyboardWillHide" : "keyboardDidHide";
    const durationOf = (e?: KeyboardEvent) =>
      ios && e?.duration ? e.duration : ANDROID_ANIMATION_MS;

    const show = Keyboard.addListener(showEvent, (e) => {
      const frame = e?.endCoordinates;
      const height = ios
        ? Math.max(0, Dimensions.get("screen").height - (frame?.screenY ?? Infinity))
        : frame?.height ?? 0;
      setState({ height, duration: durationOf(e) });
    });
    const hide = Keyboard.addListener(hideEvent, (e) =>
      setState({ height: 0, duration: durationOf(e) }),
    );
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);

  const visible = state.height > 0;
  const screenOverlap = !visible
    ? 0
    : Platform.OS === "android"
      ? state.height + bottomInset
      : state.height;

  return { visible, screenOverlap, animationDuration: state.duration };
}
