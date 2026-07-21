import { useCallback } from "react";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { StyleSheet, Text, type StyleProp, type TextStyle } from "react-native";

import type { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Props = {
  /** Lead-in copy, e.g. "By creating an account, you agree to our". */
  prefix: string;
  /** Container text style so each screen keeps its own spacing. */
  style?: StyleProp<TextStyle>;
  /** Blocks navigation while a form is submitting. */
  disabled?: boolean;
};

/**
 * The "you agree to our Terms / Privacy Policy" line, with both documents
 * actually tappable.
 *
 * Implemented as nested `<Text onPress>` rather than `Pressable` so the links
 * stay in the text flow and wrap naturally mid-sentence — a `Pressable` would
 * force a layout box and break the line.
 *
 * Web opens `/terms` and `/privacy` in a new tab; on mobile the equivalent is
 * pushing the in-app legal screens, which keeps the user in the app rather
 * than bouncing them to a browser.
 */
export function LegalConsentText({ prefix, style, disabled }: Readonly<Props>) {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const openTerms = useCallback(() => {
    if (!disabled) navigation.navigate("TermsOfService");
  }, [navigation, disabled]);

  const openPrivacy = useCallback(() => {
    if (!disabled) navigation.navigate("PrivacyPolicy");
  }, [navigation, disabled]);

  return (
    <Text style={style}>
      {prefix}{" "}
      <Text
        style={[styles.link, disabled && styles.linkDisabled]}
        onPress={openTerms}
        suppressHighlighting
        accessibilityRole="link"
        accessibilityLabel="Terms of Service"
      >
        Terms of Service
      </Text>
      {" and "}
      <Text
        style={[styles.link, disabled && styles.linkDisabled]}
        onPress={openPrivacy}
        suppressHighlighting
        accessibilityRole="link"
        accessibilityLabel="Privacy Policy"
      >
        Privacy Policy
      </Text>
    </Text>
  );
}

const styles = StyleSheet.create({
  link: { color: colors.ctaAccent, fontWeight: "700", textDecorationLine: "underline" },
  linkDisabled: { opacity: 0.5 },
});
