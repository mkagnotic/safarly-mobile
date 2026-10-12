import { useCallback, useState } from "react";
import { Platform, type LayoutChangeEvent } from "react-native";
import { type EdgeInsets } from "react-native-safe-area-context";

import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";

/**
 * Keyboard lift for the conversation: how far the container and the composer
 * have to move so the composer sits flush on the keyboard.
 */
export function useChatKeyboardLayout(insets: EdgeInsets) {
  // Keyboard reach comes from the shared hook, which already corrects for
  // Android reporting the keyboard without the navigation bar.
  const { visible: keyboardOpen, screenOverlap } = useKeyboardMetrics();
  // With the keyboard up the gesture bar is behind it, so reserving that inset
  // too would float the composer on a band of dead space.
  const composerBottomPad = keyboardOpen
    ? 10
    : Math.max(insets.bottom, Platform.OS === "ios" ? 18 : 10);
  // How much of the keyboard the OS has already made room for.
  //
  // iOS never resizes the window for the keyboard, so it always needs the full
  // lift. Android is inconsistent: some versions resize the window under Expo's
  // edge-to-edge (lift by the full reach there and the composer floats on a
  // large empty band), while Android 15 with targetSdk 35+ enforces
  // edge-to-edge and does NOT resize, which left the composer entirely under
  // the keyboard. Hard-coding either assumption breaks the other, so measure:
  // remember the container's height with the keyboard closed, and lift only by
  // whatever the OS did not already take off it.
  const [restContainerHeight, setRestContainerHeight] = useState(0);
  const [containerHeight, setContainerHeight] = useState(0);
  const onContainerLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const h = e.nativeEvent.layout.height;
      setContainerHeight(h);
      if (!keyboardOpen) setRestContainerHeight(h);
    },
    [keyboardOpen],
  );
  const containerKeyboardPad = (() => {
    if (!keyboardOpen) return 0;
    if (Platform.OS === "ios") return screenOverlap;
    const absorbedByResize =
      restContainerHeight > 0 && containerHeight > 0
        ? Math.max(0, restContainerHeight - containerHeight)
        : 0;
    return Math.max(0, screenOverlap - absorbedByResize);
  })();

  return { keyboardOpen, composerBottomPad, onContainerLayout, containerKeyboardPad };
}
