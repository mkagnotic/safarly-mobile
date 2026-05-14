import { useCallback, useState } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { useNavigation } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { showToast } from "@/feedback/appFeedback";
import { useShallow } from "zustand/react/shallow";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";

type Nav = BottomTabNavigationProp<MainTabParamList, "AddCardTab">;

const TITLE_COLOR = colors.text;
const INPUT_BG = "#F7F5EF";
const INPUT_BORDER = "#EEE8DE";
const INPUT_TEXT = colors.mutedText;
const LABEL_MUTED = colors.mutedText;

function formatCardNumber(raw: string): string {
  const digits = raw.replaceAll(/\D/g, "").slice(0, 16);
  const chunks = digits.match(/.{1,4}/g);
  return chunks ? chunks.join(" ") : "";
}

function formatExpiry(raw: string): string {
  const digits = raw.replaceAll(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

function sanitizeDigits(raw: string, maxLength: number): string {
  return raw.replaceAll(/\D/g, "").slice(0, maxLength);
}

function cardBrandFromDigits(digits: string): string {
  if (digits.startsWith("4")) return "Visa";
  if (digits.startsWith("5")) return "Mastercard";
  return "Card";
}

export function AddCardScreen() {
  const navigation = useNavigation<Nav>();
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [cardNumber, setCardNumber] = useState("1234 5678 9012 3456");
  const [cardholderName, setCardholderName] = useState("Alex Johnson");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const { addPaymentMethod, setLiveDataVisibility } = useAppStore(
    useShallow((s) => ({
      addPaymentMethod: s.addPaymentMethod,
      setLiveDataVisibility: s.setLiveDataVisibility,
    }))
  );

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    navigation.navigate("WalletTab");
  }, [navigation]);

  const onDone = useCallback(() => {
    navigation.navigate("WalletTab");
  }, [navigation]);

  const onSave = useCallback(() => {
    const digits = cardNumber.replaceAll(/\D/g, "");
    const cleanName = cardholderName.trim();
    const cleanExpiry = expiry.trim();

    if (digits.length < 16) {
      showToast({ title: "Invalid card number", message: "Please enter a valid 16-digit card number.", variant: "error" });
      return;
    }
    if (!cleanName) {
      showToast({ title: "Missing name", message: "Please enter the cardholder name.", variant: "error" });
      return;
    }
    addPaymentMethod({
      brand: cardBrandFromDigits(digits),
      last4: digits.slice(-4),
      expiry: cleanExpiry.length > 0 ? cleanExpiry : "12/27",
    });
    setLiveDataVisibility(true);
    setSaveSuccess(true);
  }, [addPaymentMethod, cardNumber, cardholderName, expiry, setLiveDataVisibility]);

  return (
    <Screen safeBackgroundColor={colors.card} refreshEnabled={false} contentContainerStyle={styles.content}>
      <View style={styles.headerRow}>
        <Pressable style={styles.backButton} onPress={goBack} accessibilityRole="button" accessibilityLabel="Go back">
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Add Card</Text>
      </View>

      {saveSuccess ? (
        <View style={styles.successWrap}>
          <View style={styles.successIconCircle}>
            <Ionicons name="checkmark" size={34} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Card Added!</Text>
          <Text style={styles.successSubtitle}>Your payment method has been saved securely.</Text>
          <Pressable style={styles.doneButton} onPress={onDone} accessibilityRole="button">
            <Text style={styles.doneLabel}>Done</Text>
          </Pressable>
        </View>
      ) : (
        <>
          <View style={styles.secureBanner}>
            <Ionicons name="shield-checkmark-outline" size={18} color={colors.mutedText} />
            <Text style={styles.secureText}>Your card details are encrypted and stored securely.</Text>
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>CARD NUMBER</Text>
            <TextInput
              value={cardNumber}
              onChangeText={(v) => setCardNumber(formatCardNumber(v))}
              keyboardType="number-pad"
              style={styles.input}
              placeholder="1234 5678 9012 3456"
              placeholderTextColor={colors.subtleText}
            />
          </View>

          <View style={styles.fieldBlock}>
            <Text style={styles.fieldLabel}>CARDHOLDER NAME</Text>
            <TextInput
              value={cardholderName}
              onChangeText={setCardholderName}
              style={styles.input}
              placeholder="Alex Johnson"
              placeholderTextColor={colors.subtleText}
              autoCapitalize="words"
            />
          </View>

          <View style={styles.row}>
            <View style={[styles.fieldBlock, styles.half]}>
              <Text style={styles.fieldLabel}>EXPIRY</Text>
              <TextInput
                value={expiry}
                onChangeText={(v) => setExpiry(formatExpiry(v))}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="MM/YY"
                placeholderTextColor={colors.subtleText}
              />
            </View>
            <View style={[styles.fieldBlock, styles.half]}>
              <Text style={styles.fieldLabel}>CVV</Text>
              <TextInput
                value={cvv}
                onChangeText={(v) => setCvv(sanitizeDigits(v, 4))}
                keyboardType="number-pad"
                style={styles.input}
                placeholder="•••"
                placeholderTextColor={colors.subtleText}
                secureTextEntry
              />
            </View>
          </View>

          <Pressable style={styles.saveButton} onPress={onSave} accessibilityRole="button">
            <Text style={styles.saveLabel}>Save Card</Text>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingBottom: 24,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
    gap: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    color: TITLE_COLOR,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
  },
  secureBanner: {
    minHeight: 64,
    backgroundColor: "#22324A",
    borderRadius: 16,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 16,
  },
  secureText: {
    flex: 1,
    color: colors.white,
    fontSize: 11,
    lineHeight: 15,
    fontWeight: "600",
  },
  fieldBlock: {
    marginBottom: 14,
  },
  fieldLabel: {
    color: LABEL_MUTED,
    fontSize: 11,
    lineHeight: 16,
    fontWeight: "700",
    letterSpacing: 0.8,
    marginBottom: 8,
  },
  input: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    color: INPUT_TEXT,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
    paddingHorizontal: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  half: {
    flex: 1,
  },
  saveButton: {
    marginTop: 8,
    minHeight: 48,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  saveLabel: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
  successWrap: {
    marginTop: 74,
    alignItems: "center",
  },
  successIconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#D9EFE5",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 18,
  },
  successTitle: {
    color: TITLE_COLOR,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: "800",
    marginBottom: 8,
  },
  successSubtitle: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
    textAlign: "center",
    marginBottom: 20,
  },
  doneButton: {
    minWidth: 84,
    minHeight: 40,
    borderRadius: 12,
    paddingHorizontal: 24,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  doneLabel: {
    color: colors.white,
    fontSize: 15,
    lineHeight: 20,
    fontWeight: "800",
  },
});
