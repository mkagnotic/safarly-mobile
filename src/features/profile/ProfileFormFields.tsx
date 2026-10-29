import { type ReactNode } from "react";
import { StyleSheet, Text, TextInput, View } from "react-native";

import { CountryPicker } from "@/components/ui/CountryPicker";
import { colors } from "@/theme/colors";

export interface ProfileFormErrors {
  name?: string;
  city?: string;
  country?: string;
}

interface Props {
  name: string;
  city: string;
  country: string | null;
  bio: string;
  onName: (v: string) => void;
  onCity: (v: string) => void;
  onCountry: (v: string) => void;
  onBio: (v: string) => void;
  errors?: ProfileFormErrors;
  disabled?: boolean;
  /** When true, the Name label gets a "*" suffix and the input shows `(required)` placeholder. */
  nameRequired?: boolean;
  /**
   * Layout mode:
   *   - "stacked" (default): every field gets a full row (best inside narrow forms / wizards).
   *   - "grid":   City + Country share a row (matches web's onboarding layout).
   */
  layout?: "stacked" | "grid";
}

/**
 * The Name + Bio + City + Country block from the web's CustomerEditProfile and
 * CustomerOnboarding pages, factored into one component so EditProfileScreen
 * and ProfileSetupScreen can share validation and styling.
 *
 * Owns no state — purely controlled. Caller decides what's required and what
 * error message belongs where.
 */
export function ProfileFormFields({
  name,
  city,
  country,
  bio,
  onName,
  onCity,
  onCountry,
  onBio,
  errors,
  disabled,
  nameRequired,
  layout = "stacked",
}: Readonly<Props>) {
  return (
    <View style={styles.column}>
      <Field label={`Full name${nameRequired ? " *" : ""}`} error={errors?.name}>
        <TextInput
          value={name}
          onChangeText={onName}
          style={[styles.input, errors?.name ? styles.inputError : null]}
          placeholder="Your full name"
          placeholderTextColor={colors.subtleText}
          maxLength={100}
          autoCapitalize="words"
          autoCorrect
          editable={!disabled}
          returnKeyType="next"
        />
      </Field>

      {/* Country before City — matches web (onboarding and Edit Profile both
          order it this way) and reads as a natural narrowing: pick the country,
          then the city inside it. */}
      {layout === "grid" ? (
        <View style={styles.gridRow}>
          <View style={styles.gridCol}>
            <CountryField
              country={country}
              onCountry={onCountry}
              error={errors?.country}
              disabled={disabled}
            />
          </View>
          <View style={styles.gridCol}>
            <CityField
              city={city}
              onCity={onCity}
              error={errors?.city}
              disabled={disabled}
            />
          </View>
        </View>
      ) : (
        <>
          <CountryField
            country={country}
            onCountry={onCountry}
            error={errors?.country}
            disabled={disabled}
          />
          <CityField city={city} onCity={onCity} error={errors?.city} disabled={disabled} />
        </>
      )}

      <Field label="Bio" hint={`${bio.length}/280`}>
        <TextInput
          value={bio}
          onChangeText={onBio}
          style={[styles.input, styles.inputMultiline]}
          placeholder="A line or two about you, like where you often travel"
          placeholderTextColor={colors.subtleText}
          multiline
          textAlignVertical="top"
          editable={!disabled}
          maxLength={280}
        />
      </Field>
    </View>
  );
}

// ───────────────────────── Sub-components ─────────────────────────

function CityField({
  city,
  onCity,
  error,
  disabled,
}: Readonly<{ city: string; onCity: (v: string) => void; error?: string; disabled?: boolean }>) {
  return (
    <Field label="City" error={error}>
      <TextInput
        value={city}
        onChangeText={onCity}
        style={[styles.input, error ? styles.inputError : null]}
        placeholder="Your city"
        maxLength={100}
        placeholderTextColor={colors.subtleText}
        autoCapitalize="words"
        editable={!disabled}
        returnKeyType="next"
      />
    </Field>
  );
}

function CountryField({
  country,
  onCountry,
  error,
  disabled,
}: Readonly<{
  country: string | null;
  onCountry: (v: string) => void;
  error?: string;
  disabled?: boolean;
}>) {
  return (
    <Field label="Country" error={error}>
      <CountryPicker
        value={country}
        onChange={onCountry}
        disabled={disabled}
        invalid={Boolean(error)}
      />
    </Field>
  );
}

function Field({
  label,
  children,
  error,
  hint,
}: Readonly<{ label: string; children: ReactNode; error?: string; hint?: string }>) {
  return (
    <View style={styles.fieldBlock}>
      <Text style={styles.fieldLabel}>{label}</Text>
      {children}
      {hint && !error ? <Text style={styles.fieldHint}>{hint}</Text> : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  column: { gap: 14 },
  gridRow: { flexDirection: "row", gap: 10 },
  gridCol: { flex: 1 },
  fieldBlock: { gap: 8 },
  fieldHint: { alignSelf: "flex-end", fontSize: 11, color: colors.subtleText, marginTop: 4 },
  fieldLabel: { color: colors.mutedText, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  input: {
    minHeight: 50,
    borderRadius: 12,
    backgroundColor: colors.input,
    color: colors.text,
    fontSize: 15,
    paddingHorizontal: 16,
  },
  inputMultiline: { minHeight: 96, paddingTop: 12, paddingBottom: 12 },
  inputError: { borderWidth: 1, borderColor: colors.danger },
  errorText: { color: colors.danger, fontSize: 12, fontWeight: "500" },
});
