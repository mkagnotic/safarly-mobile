import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

export type KycPromptVariant = "welcome" | "payment";

interface KycPromptDialogProps {
  open: boolean;
  variant: KycPromptVariant;
  /** Payment variant only — `true` when a submission is already under review. */
  pending?: boolean;
  /** Dismiss without navigating (backdrop / secondary button / close). */
  onClose: () => void;
  /** Primary CTA — caller closes the dialog and routes to the KYC screen. */
  onVerify: () => void;
}

interface Copy {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  body: string;
  cta: string;
  dismiss: string;
}

/**
 * Single prompt dialog with three resolved copy sets (web parity with
 * `KycPromptDialog.tsx`): welcome, payment-required, payment-pending. The CTA
 * routes to the KYC screen; dismiss just closes.
 */
export function KycPromptDialog({
  open,
  variant,
  pending = false,
  onClose,
  onVerify,
}: Readonly<KycPromptDialogProps>) {
  const copy = resolveCopy(variant, pending);

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.iconBubble}>
            <Ionicons name={copy.icon} size={26} color={colors.primary} />
          </View>
          <Text style={styles.title}>{copy.title}</Text>
          <Text style={styles.body}>{copy.body}</Text>

          <View style={styles.footer}>
            <Pressable
              onPress={onClose}
              style={[styles.button, styles.dismissButton]}
              accessibilityRole="button"
              accessibilityLabel={copy.dismiss}
            >
              <Text style={styles.dismissText}>{copy.dismiss}</Text>
            </Pressable>
            <Pressable
              onPress={onVerify}
              style={[styles.button, styles.ctaButton]}
              accessibilityRole="button"
              accessibilityLabel={copy.cta}
            >
              <Text style={styles.ctaText}>{copy.cta}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function resolveCopy(variant: KycPromptVariant, pending: boolean): Copy {
  if (variant === "welcome") {
    return {
      icon: "shield-checkmark-outline",
      title: "Verify your identity",
      body: "Complete a quick identity check to send parcels and make secure payments. It only takes a minute.",
      cta: "Verify now",
      dismiss: "Maybe later",
    };
  }
  if (pending) {
    return {
      icon: "time-outline",
      title: "Verification under review",
      body: "Your documents are being reviewed. You'll be able to pay once it's approved — usually within 1–2 business days.",
      cta: "View status",
      dismiss: "Close",
    };
  }
  return {
    icon: "shield-half-outline",
    title: "Verification required",
    body: "For your security, please complete identity verification before making a payment.",
    cta: "Complete verification",
    dismiss: "Not now",
  };
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.4)",
  },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: {
    width: "100%",
    maxWidth: 420,
    borderRadius: 18,
    backgroundColor: colors.card,
    padding: 22,
    alignItems: "center",
    gap: 8,
  },
  iconBubble: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  title: { color: colors.text, fontSize: 18, fontWeight: "800", textAlign: "center" },
  body: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    textAlign: "center",
    maxWidth: 320,
    marginBottom: 8,
  },
  footer: { flexDirection: "row", gap: 10, alignSelf: "stretch", marginTop: 4 },
  button: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  dismissButton: { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
  dismissText: { color: colors.text, fontSize: 14, fontWeight: "700" },
  ctaButton: { backgroundColor: colors.primary },
  ctaText: { color: colors.white, fontSize: 14, fontWeight: "800" },
});
