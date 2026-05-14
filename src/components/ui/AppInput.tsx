import { StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { colors } from "@/theme/colors";

type Props = TextInputProps & {
  label?: string;
  error?: string;
};

export function AppInput({ label, error, style, ...rest }: Props) {
  return (
    <View style={styles.wrap}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <TextInput
        placeholderTextColor={colors.mutedText}
        style={[styles.input, rest.multiline && styles.multiline, error && styles.inputError, style]}
        {...rest}
      />
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  );
}

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
});
