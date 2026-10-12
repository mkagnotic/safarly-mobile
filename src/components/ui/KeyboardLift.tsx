import { useEffect, useRef, type ReactNode } from "react";
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Platform,
  type StyleProp,
  type ViewStyle,
} from "react-native";

import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";

interface KeyboardLiftProps {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}

/**
 * Drop-in replacement for the `KeyboardAvoidingView` that wraps the content of
 * a centred, text-input Modal (report, offer composer, edit forms, …).
 *
 * - iOS: exactly the old `KeyboardAvoidingView behavior="padding"` — a Modal's
 *   window is not resized for the keyboard there, and padding has always
 *   lifted these cards correctly.
 * - Android: the content is padded up by the keyboard's real reach from
 *   `useKeyboardMetrics`, animated like `KeyboardAwareSheet`, so a centred card
 *   re-centres in the space above it.
 *
 * REQUIRES an edge-to-edge Modal on Android: `statusBarTranslucent` and
 * `navigationBarTranslucent`, exactly like `KeyboardAwareSheet`. Without them
 * Android resizes the Modal's window for the keyboard AND this adds the lift
 * again — the card was pushed up twice as far, squeezed, and its buttons ended
 * up with zero height (found on the emulator, 2026-10-12).
 */
export function KeyboardLift({ children, style }: Readonly<KeyboardLiftProps>) {
  if (Platform.OS === "ios") {
    return (
      <KeyboardAvoidingView behavior="padding" style={style}>
        {children}
      </KeyboardAvoidingView>
    );
  }
  return <AndroidKeyboardLift style={style}>{children}</AndroidKeyboardLift>;
}

function AndroidKeyboardLift({ children, style }: Readonly<KeyboardLiftProps>) {
  const { screenOverlap, animationDuration } = useKeyboardMetrics();
  const lift = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(lift, {
      toValue: screenOverlap,
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
      // `paddingBottom` is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    }).start();
  }, [lift, screenOverlap, animationDuration]);

  return <Animated.View style={[style, { paddingBottom: lift }]}>{children}</Animated.View>;
}
