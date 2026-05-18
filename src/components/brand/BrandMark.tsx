import { StyleSheet, Text, View } from "react-native";
import { SafarlyMark } from "@/components/brand/SafarlyMark";
import { colors } from "@/theme/colors";

type Props = {
  /** Mark glyph height in px (web default ≈ 36 / `h-9`). */
  markSize?: number;
  /** Wordmark font size in px (web `text-xl` ≈ 20). */
  textSize?: number;
  /** Space between mark and wordmark in px (web `gap-2.5` ≈ 10). */
  gap?: number;
};

/**
 * Horizontal Safarly lockup (mark glyph + "Safarly" wordmark) — a direct port
 * of web `safarly_web/src/components/brand/BrandMark.tsx`, which is the single
 * brand element the web app uses everywhere (navbar, footer, auth, splash).
 * Scale via `markSize` / `textSize` for hero vs. inline use.
 */
export function BrandMark({ markSize = 36, textSize = 20, gap = 10 }: Props) {
  return (
    <View style={[styles.row, { gap }]}>
      <SafarlyMark size={markSize} />
      <Text style={[styles.word, { fontSize: textSize }]}>Safarly</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
  word: {
    color: colors.wordmark,
    fontWeight: "700",
    letterSpacing: -0.5,
  },
});
