import { useCallback, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";

import { AppButton } from "@/components/ui/AppButton";
import { AppInput } from "@/components/ui/AppInput";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { getErrorMessage, paymentsApi, type RazorpayFundAccountInput } from "@/services/api";
import { colors } from "@/theme/colors";

/**
 * Payout setup for carriers paid through Razorpay — the mobile twin of the web
 * `RazorpayPayoutForm`.
 *
 * Stripe Connect hands the carrier off to a hosted onboarding page in a browser;
 * Razorpay has no equivalent, so the destination account is collected in-app and
 * turned into a RazorpayX fund account server-side. Safarly never stores these
 * values — they go straight to Razorpay and only the resulting fund-account id
 * is persisted.
 *
 * Rendered because the SERVER said `setup_kind: 'bank_details'`, never because
 * the app decided the user is Indian.
 */

const IFSC_RE = /^[A-Za-z]{4}0[A-Za-z0-9]{6}$/;
const VPA_RE = /^[\w.-]{2,64}@[a-zA-Z]{2,64}$/;

interface RazorpayPayoutFormProps {
  /** Prefills the account holder name from the profile. */
  defaultName?: string | null;
  /** True when a fund account already exists — the form then updates it. */
  hasAccount?: boolean;
  /** Re-read the server status after a successful submit. */
  onSaved: () => void | Promise<void>;
}

export function RazorpayPayoutForm({ defaultName, hasAccount, onSaved }: Readonly<RazorpayPayoutFormProps>) {
  const [mode, setMode] = useState<"bank_account" | "vpa">("bank_account");
  const [name, setName] = useState(defaultName ?? "");
  const [accountNumber, setAccountNumber] = useState("");
  const [ifsc, setIfsc] = useState("");
  const [vpa, setVpa] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Validate here as well as on the server, so an obvious typo is caught before
  // it becomes a provider round-trip and a raw Razorpay rejection.
  const validate = useCallback((): RazorpayFundAccountInput | null => {
    const next: Record<string, string> = {};
    if (mode === "bank_account") {
      if (!name.trim()) next.name = "Enter the name on the bank account";
      if (!/^\d{6,18}$/.test(accountNumber.replace(/\s/g, ""))) {
        next.accountNumber = "Enter a valid account number";
      }
      if (!IFSC_RE.test(ifsc.trim())) next.ifsc = "Enter a valid IFSC code (e.g. HDFC0001234)";
    } else if (!VPA_RE.test(vpa.trim())) {
      next.vpa = "Enter a valid UPI id (e.g. name@bank)";
    }
    setErrors(next);
    if (Object.keys(next).length > 0) return null;

    return mode === "bank_account"
      ? {
          mode: "bank_account",
          account_holder_name: name.trim(),
          account_number: accountNumber.replace(/\s/g, ""),
          ifsc: ifsc.trim().toUpperCase(),
        }
      : { mode: "vpa", vpa: vpa.trim(), account_holder_name: name.trim() || undefined };
  }, [mode, name, accountNumber, ifsc, vpa]);

  const submit = useCallback(async () => {
    if (busy) return;
    const input = validate();
    if (!input) return;
    setSubmitError(null);
    setBusy(true);
    try {
      await paymentsApi.submitRazorpayFundAccount(input);
      setAccountNumber("");
      setIfsc("");
      setVpa("");
      await onSaved();
    } catch (err) {
      setSubmitError(getErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [busy, validate, onSaved]);

  return (
    <View>
      <View style={styles.modeRow}>
        {[
          { value: "bank_account" as const, label: "Bank account", icon: "cash-outline" as const },
          { value: "vpa" as const, label: "UPI id", icon: "phone-portrait-outline" as const },
        ].map((opt) => {
          const active = mode === opt.value;
          return (
            <Pressable
              key={opt.value}
              onPress={() => {
                setMode(opt.value);
                setErrors({});
              }}
              style={[styles.modeChip, active && styles.modeChipActive]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={opt.label}
            >
              <Ionicons name={opt.icon} size={16} color={active ? colors.primary : colors.mutedText} />
              <Text style={[styles.modeLabel, active && styles.modeLabelActive]}>{opt.label}</Text>
            </Pressable>
          );
        })}
      </View>

      {mode === "bank_account" ? (
        <>
          <AppInput
            label="Account holder name"
            value={name}
            onChangeText={setName}
            placeholder="As printed on your bank account"
            autoComplete="name"
            error={errors.name}
          />
          <AppInput
            label="Account number"
            value={accountNumber}
            onChangeText={setAccountNumber}
            placeholder="e.g. 0123456789012"
            keyboardType="number-pad"
            error={errors.accountNumber}
          />
          <AppInput
            label="IFSC code"
            value={ifsc}
            onChangeText={(v) => setIfsc(v.toUpperCase())}
            placeholder="e.g. HDFC0001234"
            autoCapitalize="characters"
            autoCorrect={false}
            error={errors.ifsc}
          />
        </>
      ) : (
        <AppInput
          label="UPI id"
          value={vpa}
          onChangeText={setVpa}
          placeholder="e.g. yourname@okhdfcbank"
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          error={errors.vpa}
        />
      )}

      {submitError ? <Text style={styles.submitError}>{submitError}</Text> : null}

      <AppButton
        label={hasAccount ? "Update payout details" : "Set up payouts"}
        onPress={() => void submit()}
        disabled={busy}
        leftIcon={busy ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
      />

      <Text style={styles.disclaimer}>
        Your details are sent straight to Razorpay and are never stored by Safarly.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: { flexDirection: "row", gap: 10, marginBottom: 16 },
  modeChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.input,
  },
  modeChipActive: { borderColor: colors.primary, backgroundColor: `${colors.primary}14` },
  modeLabel: { color: colors.mutedText, fontSize: 13, fontWeight: "600" },
  modeLabelActive: { color: colors.primary },
  submitError: { color: colors.danger, fontSize: 12, fontWeight: "500", marginBottom: 10 },
  disclaimer: {
    color: colors.mutedText,
    fontSize: 11,
    lineHeight: 16,
    textAlign: "center",
    marginTop: 10,
  },
});
