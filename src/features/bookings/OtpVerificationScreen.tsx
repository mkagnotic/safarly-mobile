import { useCallback, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, TextInput, View } from "react-native";
import { useNavigation, useRoute } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { AppButton } from "@/components/ui/AppButton";
import { Card } from "@/components/ui/Card";
import { Screen } from "@/components/ui/Screen";
import { MainTabParamList } from "@/navigation/types";
import { useAppStore } from "@/store/useAppStore";
import { colors } from "@/theme/colors";
import { showToast } from "@/feedback/appFeedback";

const OTP_LENGTH = 4;

export function OtpVerificationScreen() {
  const navigation = useNavigation<BottomTabNavigationProp<MainTabParamList>>();
  const route = useRoute();
  const bookingId = (route.params as any)?.bookingId ?? "BK-001";
  const verifyOtp = useAppStore((s) => s.verifyOtp);
  const booking = useAppStore((s) => s.bookings.find((b) => b.id === bookingId));

  const [digits, setDigits] = useState<string[]>(Array(OTP_LENGTH).fill(""));
  const [error, setError] = useState("");
  const [verified, setVerified] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const goBack = useCallback(() => {
    if (navigation.canGoBack()) navigation.goBack();
    else navigation.navigate("Home");
  }, [navigation]);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    const next = [...digits];
    next[index] = value;
    setDigits(next);
    setError("");
    if (value && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (index: number, key: string) => {
    if (key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = () => {
    const otp = digits.join("");
    if (otp.length < OTP_LENGTH) {
      setError("Please enter all 4 digits");
      return;
    }
    const success = verifyOtp(bookingId, otp);
    if (success) {
      setVerified(true);
      showToast({ title: "Delivery Confirmed!", variant: "success" });
    } else {
      setAttempts((a) => a + 1);
      setError(`Wrong OTP. ${3 - attempts - 1} attempts remaining.`);
      if (attempts >= 2) {
        setError("Too many failed attempts. Please contact support.");
      }
    }
  };

  if (verified) {
    return (
      <Screen>
        <View style={styles.successWrap}>
          <View style={styles.successIcon}>
            <Ionicons name="checkmark-circle" size={80} color={colors.safe} />
          </View>
          <Text style={styles.successTitle}>Delivery Confirmed!</Text>
          <Text style={styles.successSubtitle}>
            The package has been successfully delivered. Payment will be released to the carrier.
          </Text>
          <Card style={styles.successCard}>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Booking</Text>
              <Text style={styles.detailValue}>{bookingId}</Text>
            </View>
            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Amount</Text>
              <Text style={[styles.detailValue, { color: colors.safe }]}>{booking?.amount ?? "$45"}</Text>
            </View>
          </Card>
          <AppButton
            label="Leave a Review"
            onPress={() => navigation.navigate("DeliveryReviewTab" as any, { bookingId })}
            style={styles.reviewCta}
          />
          <Pressable onPress={() => navigation.navigate("Home")} style={styles.homeLinkWrap}>
            <Text style={styles.homeLink}>Back to Home</Text>
          </Pressable>
        </View>
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.headerRow}>
        <Pressable onPress={goBack} style={styles.backButton}>
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.title}>Verify Delivery</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.iconWrap}>
          <Ionicons name="key-outline" size={48} color={colors.primary} />
        </View>
        <Text style={styles.heading}>Enter OTP</Text>
        <Text style={styles.desc}>
          Ask the receiver for the 4-digit OTP to confirm delivery of the package.
        </Text>

        <View style={styles.otpRow}>
          {digits.map((d, i) => (
            <TextInput
              key={i}
              ref={(ref) => { inputRefs.current[i] = ref; }}
              value={d}
              onChangeText={(v) => handleDigitChange(i, v)}
              onKeyPress={(e) => handleKeyPress(i, e.nativeEvent.key)}
              style={[styles.otpInput, error && styles.otpInputError]}
              keyboardType="number-pad"
              maxLength={1}
              selectTextOnFocus
            />
          ))}
        </View>

        {error ? (
          <View style={styles.errorRow}>
            <Ionicons name="alert-circle" size={16} color={colors.danger} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <AppButton
          label="Verify OTP"
          onPress={handleVerify}
          disabled={digits.some((d) => !d) || attempts >= 3}
          style={styles.verifyCta}
        />

        <Pressable style={styles.resendRow}>
          <Text style={styles.resendText}>Didn't receive OTP? </Text>
          <Text style={styles.resendLink}>Resend</Text>
        </Pressable>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: "row", alignItems: "center", marginTop: 16, marginBottom: 20, gap: 12 },
  backButton: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: colors.surfaceMuted, alignItems: "center", justifyContent: "center",
  },
  title: { color: colors.text, fontSize: 22, fontWeight: "800" },
  content: { alignItems: "center", paddingHorizontal: 20, paddingTop: 24 },
  iconWrap: { marginBottom: 20 },
  heading: { color: colors.text, fontSize: 24, fontWeight: "800", marginBottom: 8 },
  desc: { color: colors.mutedText, fontSize: 14, textAlign: "center", lineHeight: 20, maxWidth: 280, marginBottom: 32 },
  otpRow: { flexDirection: "row", gap: 12, marginBottom: 20 },
  otpInput: {
    width: 56, height: 64, borderRadius: 14,
    backgroundColor: colors.surfaceMuted, borderWidth: 2, borderColor: colors.inputBorder,
    textAlign: "center", fontSize: 24, fontWeight: "800", color: colors.text,
  },
  otpInputError: { borderColor: colors.danger },
  errorRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  errorText: { color: colors.danger, fontSize: 14, fontWeight: "600" },
  verifyCta: { width: "100%", marginTop: 8 },
  resendRow: { flexDirection: "row", marginTop: 20 },
  resendText: { color: colors.mutedText, fontSize: 14 },
  resendLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
  // Success
  successWrap: { alignItems: "center", paddingHorizontal: 20, paddingTop: 64 },
  successIcon: { marginBottom: 20 },
  successTitle: { color: colors.text, fontSize: 26, fontWeight: "800", marginBottom: 8 },
  successSubtitle: { color: colors.mutedText, fontSize: 15, textAlign: "center", lineHeight: 22, maxWidth: 300, marginBottom: 24 },
  successCard: { width: "100%", paddingVertical: 16, paddingHorizontal: 16, gap: 10, marginBottom: 24 },
  detailRow: { flexDirection: "row", justifyContent: "space-between" },
  detailLabel: { color: colors.mutedText, fontSize: 14 },
  detailValue: { color: colors.text, fontSize: 14, fontWeight: "700" },
  reviewCta: { width: "100%" },
  homeLinkWrap: { marginTop: 16 },
  homeLink: { color: colors.primary, fontSize: 14, fontWeight: "700" },
});
