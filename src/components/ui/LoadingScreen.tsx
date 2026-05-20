import { useEffect, useRef } from "react";
import { Animated, StyleSheet, Text, View } from "react-native";
import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { SafarlyWordmark } from "@/components/brand/SafarlyWordmark";
import { Screen } from "@/components/ui/Screen";
import { colors } from "@/theme/colors";

type Props = {
  message?: string;
};

const DOT_COUNT = 3;
const DOT_STAGGER_MS = 180;
const DOT_HALF_CYCLE_MS = 450;

export function LoadingScreen({ message }: Readonly<Props>) {
  const dots = useRef(
    Array.from({ length: DOT_COUNT }, () => new Animated.Value(0.3)),
  ).current;

  useEffect(() => {
    const anims = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * DOT_STAGGER_MS),
          Animated.timing(dot, {
            toValue: 1,
            duration: DOT_HALF_CYCLE_MS,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0.3,
            duration: DOT_HALF_CYCLE_MS,
            useNativeDriver: true,
          }),
        ]),
      ),
    );
    anims.forEach((a) => a.start());
    return () => anims.forEach((a) => a.stop());
  }, [dots]);

  return (
    <Screen edges={["top", "right", "left", "bottom"]} scroll={false}>
      <View style={styles.wrap}>
        <SafarlyMark size={72} />
        <View style={styles.wordmarkWrap}>
          <SafarlyWordmark width={132} />
        </View>

        <View style={styles.loader}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { opacity: dot, transform: [{ scale: dot }] }]}
            />
          ))}
        </View>

        {message ? <Text style={styles.message}>{message}</Text> : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, alignItems: "center", justifyContent: "center" },
  wordmarkWrap: { marginTop: 12 },
  loader: { flexDirection: "row", gap: 8, marginTop: 36 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary },
  message: { color: colors.mutedText, fontSize: 14, fontWeight: "500", marginTop: 18 },
});
