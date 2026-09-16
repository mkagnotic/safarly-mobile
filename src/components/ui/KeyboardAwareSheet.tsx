import { useCallback, useEffect, useRef, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  Animated,
  Easing,
  Keyboard,
  Modal,
  Pressable as PlainPressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { useKeyboardMetrics } from "@/hooks/useKeyboardMetrics";
import { colors } from "@/theme/colors";

/** Clearance kept above a lifted sheet so it never runs under the status bar. */
const TOP_GAP = 72;
/** Never collapse below this, even on a short screen with a tall keyboard. */
const MIN_HEIGHT = 220;

export interface KeyboardAwareSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  /** Renders the standard title row with a close button. Omit to draw your own header. */
  title?: string;
  /**
   * When false, the backdrop, the close button and Android's back button do
   * nothing — use while a request the sheet owns is still running.
   */
  dismissible?: boolean;
  /** Share of the window the sheet may take while the keyboard is closed. */
  maxHeightRatio?: number;
  /** Shows the grab handle at the top. */
  handle?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
}

/**
 * The app's bottom sheet. Every sheet that can show a keyboard — the city and
 * country pickers, the parcel review and travel document sheets — renders
 * through this, so keyboard handling lives in exactly one place.
 *
 * A `KeyboardAvoidingView` cannot do this job. The modal is translucent under
 * the status and navigation bars so it can run edge-to-edge like the rest of
 * the app, and a translucent modal window is never resized for the keyboard on
 * either platform; the frame a KeyboardAvoidingView measures against is the
 * whole screen, so it computes no avoidance at all. Instead the sheet reads the
 * keyboard's real reach from `useKeyboardMetrics` and lifts itself by exactly
 * that, animating in step with the system keyboard, while shrinking its maximum
 * height by the same amount so the header and any search field stay on screen.
 *
 * With the keyboard closed, the bottom safe-area inset is kept clear so the last
 * row never sits under the home indicator or the navigation bar.
 */
export function KeyboardAwareSheet({
  visible,
  onClose,
  children,
  title,
  dismissible = true,
  maxHeightRatio = 0.78,
  handle = true,
  style,
  accessibilityLabel,
}: Readonly<KeyboardAwareSheetProps>) {
  const { height: windowHeight } = useWindowDimensions();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const { visible: keyboardVisible, screenOverlap, animationDuration } = useKeyboardMetrics();

  const lift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(lift, {
      toValue: screenOverlap,
      duration: animationDuration,
      easing: Easing.out(Easing.cubic),
      // `bottom` is a layout property, which the native driver cannot animate.
      useNativeDriver: false,
    }).start();
  }, [lift, screenOverlap, animationDuration]);

  const maxHeight = Math.max(
    MIN_HEIGHT,
    Math.min(windowHeight * maxHeightRatio, windowHeight - screenOverlap - TOP_GAP),
  );

  const requestClose = useCallback(() => {
    if (!dismissible) return;
    Keyboard.dismiss();
    onClose();
  }, [dismissible, onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={requestClose}
    >
      {/* Plain Pressable: AppPressable's pressed scale would visibly jolt a
          full-screen backdrop. */}
      <PlainPressable
        style={styles.backdrop}
        onPress={requestClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <Animated.View
        accessibilityViewIsModal
        accessibilityLabel={accessibilityLabel ?? title}
        style={[
          styles.sheet,
          {
            bottom: lift,
            maxHeight,
            // The keyboard covers the home indicator / navigation bar, so the
            // inset only needs reserving while it is closed.
            paddingBottom: keyboardVisible ? 8 : Math.max(bottomInset, 16),
          },
          style,
        ]}
      >
        {handle ? <View style={styles.handle} /> : null}
        {title ? (
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            {dismissible ? (
              <Pressable onPress={requestClose} hitSlop={8} accessibilityRole="button" accessibilityLabel="Close">
                <Ionicons name="close" size={22} color={colors.text} />
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {children}
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15, 15, 25, 0.45)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginTop: 8,
    marginBottom: 8,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 12,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800" },
});
