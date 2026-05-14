import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  InteractionManager,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { useIsFocused } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useDimPulse } from "@/context/DimPulseContext";
import {
  colors,
  glassAtmosphere,
  glassDimPulse,
  glassVignetteGradient,
  screenBackgroundGradient,
} from "@/theme/colors";

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
  const isFocused = useIsFocused();
  const surfaceBg = safeBackgroundColor ?? colors.background;
  const useFadedGradient = safeBackgroundColor === undefined;
  const transition = useRef(new Animated.Value(1)).current;
  /** Avoid a visible flash (1 → 0 → 1) on the first paint of each screen instance. */
  const skipNextEntrance = useRef(true);
  const dimPulse = useDimPulse();
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

  useEffect(() => {
    if (!isFocused) return;
    if (skipNextEntrance.current) {
      skipNextEntrance.current = false;
      transition.setValue(1);
      return;
    }
    const enterMs = Platform.OS === "android" ? 180 : Platform.OS === "web" ? 200 : 210;
    const handle = InteractionManager.runAfterInteractions(() => {
      transition.setValue(0);
      Animated.timing(transition, {
        toValue: 1,
        duration: enterMs,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    });
    return () => {
      handle.cancel();
      transition.stopAnimation();
    };
  }, [isFocused, transition]);

  /** Opacity-only entrance: avoids stacking transforms with tab transitions (smoother than translate + fade). */
  const animatedScreenStyle = { opacity: transition };

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
        refreshEnabled ? <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} tintColor={colors.primary} /> : undefined
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
      {useFadedGradient ? (
        <>
          <LinearGradient
            colors={[...screenBackgroundGradient.colors]}
            locations={[...screenBackgroundGradient.locations]}
            start={screenBackgroundGradient.start}
            end={screenBackgroundGradient.end}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <LinearGradient
            colors={[...glassVignetteGradient.colors]}
            locations={[...glassVignetteGradient.locations]}
            start={glassVignetteGradient.start}
            end={glassVignetteGradient.end}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={[StyleSheet.absoluteFillObject, { backgroundColor: glassAtmosphere }]} pointerEvents="none" />
          <Animated.View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFillObject,
              {
                backgroundColor: glassDimPulse.layer,
                opacity: dimPulse.interpolate({
                  inputRange: [0, 1],
                  outputRange: [glassDimPulse.opacityMin, glassDimPulse.opacityMax],
                }),
              },
            ]}
          />
        </>
      ) : null}
      <SafeAreaView style={[styles.safe, { backgroundColor: innerBg }]} edges={edges}>
        {disableKeyboardAvoiding ? (
          <Animated.View style={[styles.flex, { backgroundColor: innerBg }, animatedScreenStyle]}>
            {screenBody}
          </Animated.View>
        ) : (
          <KeyboardAvoidingView
            behavior={Platform.select({ ios: "padding", android: "height", default: undefined })}
            style={[styles.flex, { backgroundColor: innerBg }]}
          >
            <Animated.View style={[styles.flex, animatedScreenStyle]}>{screenBody}</Animated.View>
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
