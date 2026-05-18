import { StyleSheet } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { heroBackgroundGradient } from "@/theme/colors";

const { base } = heroBackgroundGradient;
// Reverse once (not per render): web paints the first-listed glow on top, so
// the top-left peach glow must render last to stay the most prominent.
const glowLayers = [...heroBackgroundGradient.glows].reverse();

/**
 * Warm peach → pink → soft-purple wash with soft corner glows — RN port of web
 * `safarly_web` `.gradient-bg-hero`. Absolutely positioned, non-interactive.
 */
export function HeroBackground() {
  return (
    <>
      <LinearGradient
        colors={[...base.colors]}
        locations={[...base.locations]}
        start={base.start}
        end={base.end}
        style={StyleSheet.absoluteFillObject}
        pointerEvents="none"
      />
      {glowLayers.map((glow, i) => (
        <LinearGradient
          key={i}
          colors={[...glow.colors]}
          start={glow.start}
          end={glow.end}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
      ))}
    </>
  );
}
