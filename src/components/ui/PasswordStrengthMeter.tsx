import { useMemo } from "react";
import { StyleSheet, Text, View } from "react-native";

import { scorePassword } from "@/features/auth/passwordPolicy";
import { colors } from "@/theme/colors";

type Props = {
  password: string;
};

/**
 * Four-segment strength bar + label — the RN twin of web's
 * `PasswordStrengthMeter`. Advisory only: it never blocks submission, it just
 * nudges. Renders nothing until the user starts typing.
 */
export function PasswordStrengthMeter({ password }: Readonly<Props>) {
  const strength = useMemo(() => scorePassword(password), [password]);
  if (!password) return null;

  return (
    <View style={styles.wrap} accessibilityLiveRegion="polite">
      <View style={styles.track} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
        {[1, 2, 3, 4].map((i) => (
          <View
            key={i}
            style={[
              styles.segment,
              { backgroundColor: i <= strength.score ? strength.color : colors.border },
            ]}
          />
        ))}
      </View>
      <Text
        style={[styles.label, { color: strength.color }]}
        accessibilityLabel={`Password strength: ${strength.label}`}
      >
        {strength.label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginTop: -6, marginBottom: 12 },
  track: { flexDirection: "row", gap: 6 },
  segment: { flex: 1, height: 4, borderRadius: 2 },
  label: { marginTop: 6, fontSize: 12, fontWeight: "700" },
});
