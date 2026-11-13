import { PropsWithChildren, createContext, useCallback, useContext, useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { HeroBackground } from "@/components/ui/HeroBackground";
import { colors } from "@/theme/colors";

/**
 * When `provided: true`, an ancestor (e.g. MainTabs) is already painting a
 * continuous gradient behind all screens, so each Screen suppresses its own
 * HeroBackground. Lifting the background out of the scenes is what prevents
 * the "ghost of the other page" effect during tab transitions.
 */
export const ScreenBackgroundContext = createContext<{ provided: boolean }>({ provided: false });

/** Extra space below the safe-area top inset so headers + icons sit slightly lower on every screen. */
export const SCREEN_EXTRA_TOP = 10;

type Props = PropsWithChildren<{
  scroll?: boolean;
  contentContainerStyle?: StyleProp<ViewStyle>;
  edges?: Edge[];
  refreshEnabled?: boolean;
  onRefresh?: () => void | Promise<void>;
  /** When set, overrides the default screen background (e.g. full white surfaces). */
  safeBackgroundColor?: string;
  /**
   * Skip the wrapping KeyboardAvoidingView. Screens whose own ScrollView sets
   * `automaticallyAdjustKeyboardInsets` pass `Platform.OS === "ios"`: on iOS
   * both would apply and leave a blank band above the keyboard, while Android
   * ignores that prop and still needs this wrapper.
   */
  disableKeyboardAvoiding?: boolean;
}>;

export function Screen({
  children,
  scroll = true,
  contentContainerStyle,
  edges = ["top", "right", "left"],
  refreshEnabled = true,
  onRefresh,
  safeBackgroundColor,
  disableKeyboardAvoiding = false,
}: Props) {
  const { provided: backgroundProvidedByAncestor } = useContext(ScreenBackgroundContext);
  const surfaceBg = safeBackgroundColor ?? colors.background;
  const useFadedGradient = safeBackgroundColor === undefined;
  const renderHeroHere = useFadedGradient && !backgroundProvidedByAncestor;
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    try {
      if (onRefresh) {
        await onRefresh();
      } else {
        await new Promise<void>((resolve) => setTimeout(resolve, 700));
      }
    } finally {
      setRefreshing(false);
    }
  }, [onRefresh, refreshing]);

  // No entrance fade, ever. The screen body used to fade from opacity 0 to 1 on
  // every focus (native driver). Twice that left a whole screen invisible while
  // the tab bar and gradient still showed: Notifications (29 Oct 2026), then
  // My Bookings on staging (13 Nov 2026), after the 29 Oct fallback had already
  // reset the JS value to 1. A native-driven opacity can stay at 0 on the
  // native view whatever JS believes. A screen's visibility must not depend on
  // an animation finishing, so the body is a plain View (guard: screenFade.test.ts).

  const screenBody = scroll ? (
    <ScrollView
      style={[styles.flex, styles.transparentFill, Platform.OS === "web" ? webScrollChromeHide : null]}
      contentContainerStyle={[styles.content, contentContainerStyle]}
      showsVerticalScrollIndicator={false}
      showsHorizontalScrollIndicator={false}
      persistentScrollbar={false}
      overScrollMode="never"
      bounces={refreshEnabled}
      alwaysBounceVertical={refreshEnabled}
      keyboardShouldPersistTaps="handled"
      scrollEventThrottle={16}
      removeClippedSubviews={Platform.OS === "android"}
      refreshControl={
        refreshEnabled ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} colors={[colors.primary]} /> : undefined
      }
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, styles.transparentFill, styles.nonScrollTop, contentContainerStyle]}>{children}</View>
  );

  const innerBg = useFadedGradient ? "transparent" : surfaceBg;

  return (
    <View style={styles.root}>
      {renderHeroHere ? <HeroBackground /> : null}
      <SafeAreaView style={[styles.safe, { backgroundColor: innerBg }]} edges={edges}>
        {disableKeyboardAvoiding ? (
          <View style={[styles.flex, { backgroundColor: innerBg }]}>{screenBody}</View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: "height", default: undefined })}
            style={[styles.flex, { backgroundColor: innerBg }]}
          >
            <View style={styles.flex}>{screenBody}</View>
          </KeyboardAvoidingView>
        )}
      </SafeAreaView>
    </View>
  );
}

/** Web-only overflow hints; cast so RN types accept CSS-style keys where supported (react-native-web). */
const webScrollChromeHide = { scrollbarWidth: "none", msOverflowStyle: "none" } as unknown as ViewStyle;

const styles = StyleSheet.create({
  root: { flex: 1 },
  safe: { flex: 1 },
  flex: { flex: 1 },
  transparentFill: { backgroundColor: "transparent" },
  content: { paddingHorizontal: 20, paddingBottom: 12, paddingTop: SCREEN_EXTRA_TOP },
  nonScrollTop: { paddingTop: SCREEN_EXTRA_TOP },
});
