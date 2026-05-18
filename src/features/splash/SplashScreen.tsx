import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context"; // NOSONAR
import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { SafarlyWordmark } from "@/components/brand/SafarlyWordmark";
import { HeroBackground } from "@/components/ui/HeroBackground";
import { useAppStore } from "@/store/useAppStore";
import { colors, screenCanvas } from "@/theme/colors";

export function SplashScreen() {
  const setSplashDone = useAppStore((s) => s.setSplashDone);
  const bounce = useRef(new Animated.Value(0)).current;
  const pulse = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const bounceLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(bounce, { toValue: -6, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );

    const pulseLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(pulse, { toValue: 0.4, duration: 700, useNativeDriver: true }),
      ])
    );
    bounceLoop.start();
    pulseLoop.start();

    const timer = setTimeout(() => setSplashDone(), 2500);
    return () => {
      clearTimeout(timer);
      bounceLoop.stop();
      pulseLoop.stop();
    };
  }, [bounce, pulse, setSplashDone]);

  return (
    <View style={styles.container}>
      <HeroBackground />
      <SafeAreaView style={styles.safe} edges={["top", "right", "left", "bottom"]}>
        <View style={styles.center}>
          <Animated.View style={[styles.logoStack, { transform: [{ translateY: bounce }] }]}>
            <SafarlyMark size={104} />
            <View style={styles.wordmarkWrap}>
              <SafarlyWordmark width={164} />
            </View>
            <Text style={styles.tagline}>Connecting People And Parcels</Text>
          </Animated.View>
        </View>

        <View style={styles.loaderRow}>
          {[0, 1, 2].map((dot) => (
            <Animated.View
              key={dot}
              style={[
                styles.dot,
                {
                  opacity: pulse,
                  transform: [{ scale: dot === 1 ? pulse : 1 }],
                },
              ]}
            />
          ))}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  /** Matches native splash + gradient midpoint so nothing flashes dark purple before paint */
  container: { flex: 1, backgroundColor: screenCanvas },
  safe: { flex: 1, backgroundColor: "transparent" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 24 },
  /** Vertical brand lockup: mark → SAFARLY → tagline (matches web full logo). */
  logoStack: { alignItems: "center" },
  /** Gap between the mark glyph and the SAFARLY wordmark. */
  wordmarkWrap: { marginTop: 14 },
  tagline: {
    color: colors.primary,
    marginTop: 10,
    fontSize: 14,
    letterSpacing: 0.4,
    fontWeight: "500",
    textAlign: "center",
  },
  loaderRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 14,
  },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.primary },
});
