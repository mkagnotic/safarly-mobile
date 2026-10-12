import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { formatCountdown, isUrgent } from "@/features/bookings/paymentMath";
import { colors } from "@/theme/colors";

/**
 * Live "Xh Ym left to pay" pill for `pending_payment` bookings (web parity with
 * `PaymentExpiryCountdown`). Ticks every 30s; turns red under 6h.
 */
export function PaymentExpiryCountdown({ expiresAt }: Readonly<{ expiresAt: string | null }>) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, []);

  if (!expiresAt) return null;
  const target = new Date(expiresAt).getTime();
  if (Number.isNaN(target)) return null;
  const msLeft = target - now;
  const urgent = isUrgent(msLeft);
  const label = msLeft <= 0 ? "Payment window expired" : formatCountdown(msLeft);

  return (
    <View style={[styles.countdownPill, urgent || msLeft <= 0 ? styles.countdownPillUrgent : null]}>
      <Ionicons
        name="time-outline"
        size={11}
        color={urgent || msLeft <= 0 ? colors.danger : colors.warning}
      />
      <Text
        style={[styles.countdownText, urgent || msLeft <= 0 ? styles.countdownTextUrgent : null]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: "rgba(245,159,10,0.12)",
  },
  countdownPillUrgent: { backgroundColor: "rgba(220,40,40,0.10)" },
  countdownText: { color: colors.warning, fontSize: 11, fontWeight: "700" },
  countdownTextUrgent: { color: colors.danger },
});
