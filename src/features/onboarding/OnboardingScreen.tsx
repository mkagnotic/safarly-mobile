import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Platform, StyleSheet, Text, useWindowDimensions, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { AppButton } from "@/components/ui/AppButton";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

const swipeExitEasing = Easing.out(Easing.cubic);

/** Mint / green “travel” hero — same layout as default rings, different palette + plane styling */
const TRAVEL_GREEN = "#16A34A";
/** Warm yellow-gold shield on Trust & Safety slide (outline) */
const TRUST_SHIELD_GOLD = "#C9A227";

type OnboardingSlide = {
  title: string;
  desc: string;
  icon: keyof typeof Ionicons.glyphMap;
  bubble: string;
  visual?: "default" | "travel" | "trust";
};

const slides: OnboardingSlide[] = [
  {
    title: "Send Parcels Worldwide",
    desc: "Post your delivery request and get matched with verified travelers heading to your destination.",
    icon: "cube-outline",
    bubble: "📦",
  },
  {
    title: "Earn While You Travel",
    desc: "List your upcoming trips and earn extra money by carrying parcels along your route.",
    icon: "airplane-outline",
    bubble: "✈️",
    visual: "travel",
  },
  {
    title: "Trust & Safety First",
    desc: "Every user is KYC-verified. Payments are held in escrow until delivery is confirmed with OTP.",
    icon: "shield-checkmark-outline",
    bubble: "🔒",
    visual: "trust",
  },
  {
    title: "Travel Together",
    desc: "Connect with fellow travelers on similar routes. Build your reputation and grow your network.",
    icon: "people-outline",
    bubble: "🤝",
  },
];

export function OnboardingScreen() {
  const { width: windowWidth } = useWindowDimensions();
  const [current, setCurrent] = useState(0);
  const [direction, setDirection] = useState<1 | -1>(1);
  const finishOnboarding = useAppStore((s) => s.finishOnboarding);
  const isLast = current === slides.length - 1;
  const slideX = useRef(new Animated.Value(0)).current;
  const slideOpacity = useRef(new Animated.Value(1)).current;
  const dragX = useRef(new Animated.Value(0)).current;
  const bubbleFloat = useRef(new Animated.Value(0)).current;
  const bubbleSpin = useRef(new Animated.Value(0)).current;
  const translateX = useMemo(() => Animated.add(slideX, dragX), [slideX, dragX]);

  useEffect(() => {
    // Cancel any in-flight animations so exit swipe + enter effect never fight over the same values
    // (otherwise opacity can stay stuck at 0 after a few competing runs).
    slideX.stopAnimation();
    slideOpacity.stopAnimation();

    slideX.setValue(direction * 34);
    slideOpacity.setValue(0);

    const entrance = Animated.parallel([
      Animated.spring(slideX, {
        toValue: 0,
        stiffness: 260,
        damping: 28,
        mass: 0.85,
        useNativeDriver: true,
      }),
      Animated.timing(slideOpacity, {
        toValue: 1,
        duration: 300,
        easing: swipeExitEasing,
        useNativeDriver: true,
      }),
    ]);

    entrance.start(({ finished }) => {
      if (finished) {
        slideOpacity.setValue(1);
        slideX.setValue(0);
      }
    });

    return () => {
      entrance.stop();
    };
  }, [current, direction]);

  // Run once: bubbleFloat/bubbleSpin are stable refs — listing them in deps could re-run the effect
  // and briefly stop loops (rare, but avoids “content vanishes” glitches on some devices).
  useEffect(() => {
    const bubbleFloatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleFloat, { toValue: -6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bubbleFloat, { toValue: 6, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    const bubbleSpinLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bubbleSpin, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bubbleSpin, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    bubbleFloatLoop.start();
    bubbleSpinLoop.start();
    return () => {
      bubbleFloatLoop.stop();
      bubbleSpinLoop.stop();
    };
  }, []);

  const bubbleRotate = bubbleSpin.interpolate({
    inputRange: [0, 1],
    outputRange: ["-5deg", "5deg"],
  });

  const goToSlide = (next: number) => {
    dragX.stopAnimation();
    slideX.stopAnimation();
    slideOpacity.stopAnimation();
    dragX.setValue(0);
    if (next < 0 || next >= slides.length || next === current) return;
    setDirection(next > current ? 1 : -1);
    setCurrent(next);
  };

  const currentRef = useRef(current);
  currentRef.current = current;
  const exitSwipeInProgressRef = useRef(false);

  const applyPanTranslation = useCallback((translationX: number) => {
    const c = currentRef.current;
    let x = translationX;
    if ((c === 0 && x > 0) || (c === slides.length - 1 && x < 0)) x *= 0.22;
    dragX.setValue(x);
  }, [dragX]);

  const renderSlideIcon = (slide: OnboardingSlide) => {
    const travelPlaneStyle = Platform.OS === "ios" ? styles.travelPlaneTiltIos : styles.travelPlaneTilt;
    if (slide.visual === "travel") {
      return (
        <View style={travelPlaneStyle}>
          <Ionicons name="airplane-outline" size={48} color={TRAVEL_GREEN} />
        </View>
      );
    }

    if (slide.visual === "trust") {
      return <Ionicons name="shield-outline" size={48} color={TRUST_SHIELD_GOLD} />;
    }

    return <Ionicons name={slide.icon} size={46} color={colors.primary} />;
  };

  const handleSwipeEnd = useCallback(
    (translationX: number, velocityX: number) => {
      const w = windowWidth;
      const distanceThreshold = 56;
      const velocityThreshold = 380;
      const c = currentRef.current;
      const goNext = translationX < -distanceThreshold || velocityX < -velocityThreshold;
      const goPrev = translationX > distanceThreshold || velocityX > velocityThreshold;

      const finishExitThen = (onDone: () => void, exitTo: number) => {
        dragX.stopAnimation();
        slideX.stopAnimation();
        slideOpacity.stopAnimation();
        exitSwipeInProgressRef.current = true;

        const exitAnim = Animated.parallel([
          Animated.timing(dragX, {
            toValue: exitTo,
            duration: 280,
            easing: swipeExitEasing,
            useNativeDriver: true,
          }),
          Animated.timing(slideOpacity, {
            toValue: 0,
            duration: 240,
            easing: swipeExitEasing,
            useNativeDriver: true,
          }),
        ]);

        exitAnim.start(({ finished }) => {
          exitSwipeInProgressRef.current = false;
          if (!finished) return;
          dragX.setValue(0);
          onDone();
        });
      };

      if (goNext) {
        if (c === slides.length - 1) {
          finishExitThen(finishOnboarding, -w * 0.4);
        } else {
          finishExitThen(() => {
            setDirection(1);
            setCurrent(c + 1);
          }, -w);
        }
        return;
      }
      if (goPrev && c > 0) {
        finishExitThen(() => {
          setDirection(-1);
          setCurrent(c - 1);
        }, w);
        return;
      }

      Animated.spring(dragX, {
        toValue: 0,
        stiffness: 280,
        damping: 32,
        mass: 0.9,
        useNativeDriver: true,
      }).start();
    },
    [dragX, finishOnboarding, slideOpacity, slideX, windowWidth]
  );

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        // Run on JS thread so we avoid Reanimated worklets + installTurboModule mismatch (RN 0.81 / Expo 54).
        .runOnJS(true)
        .activeOffsetX([-18, 18])
        .failOffsetY([-22, 22])
        .onBegin(() => {
          // Don't stop dragX mid–exit-swipe; it can abort the parallel and strand opacity between 0 and 1.
          if (!exitSwipeInProgressRef.current) {
            dragX.stopAnimation();
          }
        })
        .onUpdate((e) => {
          applyPanTranslation(e.translationX);
        })
        .onEnd((e) => {
          handleSwipeEnd(e.translationX, e.velocityX);
        }),
    [applyPanTranslation, dragX, handleSwipeEnd]
  );

  /** Space reserved so the centered slide clears the absolutely positioned footer (dots + CTA). */
  const bottomBlockHeight = 132;
  const currentSlide = slides[current];

  return (
    <Screen scroll={false} edges={["top", "right", "left", "bottom"]}>
      <View style={[styles.wrap, { paddingTop: 8 }]}>
        <View style={styles.skipRow}>
          {isLast ? (
            <View />
          ) : (
            <Pressable onPress={finishOnboarding} hitSlop={8} style={styles.skipPressable}>
              <Text style={styles.skip}>Skip</Text>
            </Pressable>
          )}
        </View>

        <GestureDetector gesture={swipeGesture}>
          <View style={[styles.center, { paddingBottom: bottomBlockHeight }]}>
            <Animated.View style={{ width: "100%", alignItems: "center", transform: [{ translateX }] }}>
              <Animated.View style={{ width: "100%", alignItems: "center", opacity: slideOpacity }}>
                <View
                  style={[
                    styles.ringOuter,
                    currentSlide.visual === "travel" && styles.ringOuterTravel,
                    currentSlide.visual === "trust" && styles.ringOuterTrust,
                  ]}
                >
                  <View
                    style={[
                      styles.ringInner,
                      currentSlide.visual === "travel" && styles.ringInnerTravel,
                      currentSlide.visual === "trust" && styles.ringInnerTrust,
                    ]}
                  >
                    {renderSlideIcon(currentSlide)}
                  </View>
                  <Animated.View
                    style={[
                      styles.floatingBubble,
                      currentSlide.visual === "travel" && styles.floatingBubbleTravel,
                      currentSlide.visual === "trust" && styles.floatingBubbleTrust,
                      { transform: [{ translateY: bubbleFloat }, { rotate: bubbleRotate }] },
                    ]}
                  >
                    <Text style={styles.floatingEmoji}>{currentSlide.bubble}</Text>
                  </Animated.View>
                </View>
                <Text
                  style={[styles.title, current === 0 ? styles.titleFirstLine : styles.titleConstrained]}
                  numberOfLines={current === 0 ? 1 : undefined}
                  adjustsFontSizeToFit={current === 0}
                  minimumFontScale={current === 0 ? 0.92 : 1}
                >
                  {currentSlide.title}
                </Text>
                <Text style={styles.desc}>{currentSlide.desc}</Text>
              </Animated.View>
            </Animated.View>
          </View>
        </GestureDetector>

        <View style={[styles.bottom, { paddingBottom: 10 }]}>
          <View style={styles.dots}>
            {slides.map((slide, i) => (
              <Pressable key={slide.title} onPress={() => goToSlide(i)} style={[styles.dot, i === current && styles.activeDot]} />
            ))}
          </View>
          <AppButton
            label={isLast ? "Get Started" : "Next"}
            onPress={() => (isLast ? finishOnboarding() : goToSlide(current + 1))}
            style={styles.ctaButton}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, justifyContent: "space-between" },
  skipRow: {
    minHeight: 44,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    paddingLeft: 20,
    paddingRight: 36,
    paddingVertical: 4,
  },
  skipPressable: { paddingVertical: 8, paddingLeft: 12 },
  skip: { color: colors.mutedText, fontWeight: "600", fontSize: 14 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  ringOuterTravel: {
    backgroundColor: "#E8F5F0",
  },
  ringInnerTravel: {
    backgroundColor: "#C8EBE0",
    borderColor: "rgba(255, 255, 255, 0.9)",
  },
  travelPlaneTilt: {
    transform: [{ rotate: "-42deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  travelPlaneTiltIos: {
    transform: [{ rotate: "-42deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBubbleTravel: {
    borderWidth: 0,
    shadowOpacity: 0.07,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** Trust & safety: pale cream outer, soft peach inner, subtle floating card */
  ringOuterTrust: {
    backgroundColor: "#F7F4EF",
  },
  ringInnerTrust: {
    backgroundColor: "#EDD8C8",
    borderColor: "rgba(255, 252, 248, 0.95)",
  },
  floatingBubbleTrust: {
    backgroundColor: "#FFFFFF",
    borderWidth: 0,
    shadowOpacity: 0.06,
    shadowRadius: 7,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  ringOuter: {
    width: 176,
    height: 176,
    borderRadius: 88,
    backgroundColor: "#FDE7E1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 34,
  },
  ringInner: {
    width: 112,
    height: 112,
    borderRadius: 56,
    backgroundColor: "#FBD3C8",
    borderWidth: 4,
    borderColor: "rgba(248, 248, 249, 0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  floatingBubble: {
    position: "absolute",
    right: -14,
    top: -6,
    width: 58,
    height: 58,
    borderRadius: 16,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 6,
    elevation: 2,
  },
  floatingEmoji: { fontSize: 22 },
  title: { color: colors.text, fontSize: 24, fontWeight: "800", lineHeight: 30, textAlign: "center" },
  /** First slide: full row width so "Send Parcels Worldwide" does not wrap */
  titleFirstLine: { alignSelf: "stretch" },
  titleConstrained: { maxWidth: 280, alignSelf: "center" },
  desc: { color: colors.mutedText, marginTop: 12, fontSize: 14, lineHeight: 22, textAlign: "center", maxWidth: 260 },
  bottom: { gap: 16, position: "absolute", left: 0, right: 0, bottom: 0, paddingHorizontal: 20 },
  /** Slightly narrower than full-bleed row */
  ctaButton: { alignSelf: "center", width: "88%", maxWidth: 340 },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: "#D1D5DB" },
  activeDot: { width: 24, backgroundColor: colors.primary },
});
