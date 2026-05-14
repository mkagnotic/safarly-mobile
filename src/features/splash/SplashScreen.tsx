import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context"; // NOSONAR
import { useAppStore } from "@/store/useAppStore";
import { colors, primaryTint, screenCanvas, splashBackgroundGradient } from "@/theme/colors";

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
      <LinearGradient
        colors={[...splashBackgroundGradient.colors]}
        locations={[...splashBackgroundGradient.locations]}
        start={splashBackgroundGradient.start}
        end={splashBackgroundGradient.end}
        style={StyleSheet.absoluteFillObject}
      />
      <SafeAreaView style={styles.safe} edges={["top", "right", "left", "bottom"]}>
        <View style={styles.center}>
          <Animated.View style={[styles.logoWrap, { transform: [{ translateY: bounce }] }]}>
            <View style={styles.planeTilt}>
              <Ionicons name="airplane-outline" size={42} color={colors.primary} />
            </View>
          </Animated.View>
          <Text style={styles.logo}>Safarly</Text>
          <Text style={styles.tagline}>Deliver anywhere, travel together</Text>
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
  logoWrap: {
    width: 88,
    height: 88,
    borderRadius: 28,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: primaryTint.stroke20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 12,
    elevation: 2,
  },
  /** Line-art plane: tilt toward top-right like brand splash */
  planeTilt: {
    transform: [{ rotate: "-42deg" }],
    alignItems: "center",
    justifyContent: "center",
  },
  logo: { color: colors.text, fontSize: 34, fontWeight: "800" },
  tagline: { color: colors.mutedText, marginTop: 8, fontSize: 14, textAlign: "center" },
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
