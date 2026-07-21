import { forwardRef } from "react";
import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

type Props = TextInputProps & {
  label?: string;
  error?: string;
  /**
   * Persistent helper text shown under the field — for rules the user needs
   * before they type (e.g. password requirements). Hidden while `error` is
   * set, so the field never shows two competing messages. Prefer this over a
   * long placeholder: placeholders vanish on focus and clip in narrow fields.
   */
  hint?: string;
};

export const AppInput = forwardRef<TextInput, Props>(function AppInput(
  { label, error, hint, style, ...rest },
  ref,
) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        ref={ref}
        placeholderTextColor={colors.placeholderText}
        style={[styles.input, rest.multiline && styles.multiline, error && styles.inputError, style]}
        {...rest}
        // After {...rest} so the error hint always wins. Screen readers
        // announce the label, then the error as a hint, so a focused invalid
        // field reads "<label>, <error>".
        accessibilityLabel={rest.accessibilityLabel ?? label}
        accessibilityHint={error ?? hint ?? rest.accessibilityHint}
      />
      {error ? (
        <Text style={styles.error} accessibilityRole="alert" accessibilityLiveRegion="polite">
          {error}
        </Text>
      ) : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { color: colors.mutedText, marginBottom: 8, fontSize: 12, fontWeight: "600" },
  input: {
    backgroundColor: colors.input,
    color: colors.text,
    borderRadius: 12,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
  },
  multiline: { height: 88, paddingTop: 12, textAlignVertical: "top" },
  inputError: { borderColor: colors.danger },
  error: { color: colors.danger, fontSize: 12, fontWeight: "500", marginTop: 4 },
  hint: { color: colors.subtleText, fontSize: 12, fontWeight: "500", marginTop: 4, lineHeight: 16 },
});
