import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { colors } from "@/theme/colors";

const STAR_LABELS = ["Poor", "Fair", "Good", "Very Good", "Excellent"] as const;
const MAX_REVIEW = 500; // web parity (RateDeliveryDialog)

export interface RateDeliveryValues {
  score: number;
  review: string;
}

interface Props {
  open: boolean;
  /** Counterparty being rated (carrier or sender). */
  ratedUserName: string;
  /** Optional route line, e.g. "Delhi → Mumbai". */
  routeSummary?: string | null;
  /** True while the submit request is in flight. */
  pending: boolean;
  /** "Later" — quiet the prompt for this session. */
  onDismiss: () => void;
  onSubmit: (values: RateDeliveryValues) => void;
}

/**
 * The delivery-rating prompt shown by {@link RateDeliveryPrompt}. Mirrors web's
 * auto-opened `RateDeliveryDialog` (1–5 stars + optional comment) and matches
 * the app's `RateBuddyModal` visual language for consistency.
 */
export function RateDeliverySheet({
  open,
  ratedUserName,
  routeSummary,
  pending,
  onDismiss,
  onSubmit,
}: Readonly<Props>) {
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const wasOpenRef = useRef(false);

  // Reset on the open-transition only (not on every render while open).
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setScore(0);
      setReview("");
    }
    wasOpenRef.current = open;
  }, [open]);

  const handleSubmit = () => {
    if (score <= 0) return;
    onSubmit({ score, review: review.trim() });
  };

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onDismiss();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!pending) onDismiss();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Ionicons name="star" size={20} color={colors.warning} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Rate your delivery</Text>
              <Text style={styles.subtitle} numberOfLines={2}>
                How was your experience with <Text style={styles.subtitleStrong}>{ratedUserName}</Text>?
              </Text>
            </View>
            <Pressable
              onPress={onDismiss}
              hitSlop={8}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          {routeSummary ? (
            <View style={styles.routePill}>
              <Ionicons name="location-outline" size={13} color={colors.mutedText} />
              <Text style={styles.routeText} numberOfLines={1}>{routeSummary}</Text>
            </View>
          ) : null}

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <Pressable
                key={n}
                onPress={() => setScore(n)}
                hitSlop={4}
                disabled={pending}
                accessibilityRole="button"
                accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
              >
                <Ionicons
                  name={n <= score ? "star" : "star-outline"}
                  size={38}
                  color={n <= score ? colors.warning : colors.border}
                />
              </Pressable>
            ))}
          </View>
          <Text style={styles.scoreLabel}>{score > 0 ? STAR_LABELS[score - 1] : "Tap to rate"}</Text>

          <Text style={styles.reviewLabel}>
            Review <Text style={styles.labelMuted}>(optional)</Text>
          </Text>
          <TextInput
            value={review}
            onChangeText={(t) => setReview(t.slice(0, MAX_REVIEW))}
            placeholder="Share a few words about your experience…"
            placeholderTextColor={colors.subtleText}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
            maxLength={MAX_REVIEW}
          />

          <View style={styles.footer}>
            <AppButton
              label="Later"
              variant="secondary"
              onPress={onDismiss}
              disabled={pending}
              style={styles.footerButton}
            />
            <AppButton
              label={pending ? "Submitting…" : "Submit rating"}
              onPress={handleSubmit}
              disabled={pending || score <= 0}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={pending ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.45)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  headerIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1, gap: 3 },
  title: { color: colors.text, fontSize: 18, lineHeight: 24, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 13, lineHeight: 18 },
  subtitleStrong: { color: colors.text, fontWeight: "700" },

  routePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: colors.surfaceMuted,
  },
  routeText: { color: colors.text, fontSize: 12, fontWeight: "700" },

  starsRow: { flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 2 },
  scoreLabel: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
    marginTop: -6,
  },

  reviewLabel: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  labelMuted: { color: colors.subtleText, fontWeight: "500" },
  input: {
    backgroundColor: colors.input,
    borderColor: colors.inputBorder,
    borderWidth: 1,
    color: colors.text,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: Platform.OS === "ios" ? 12 : 10,
    fontSize: 15,
  },
  textarea: { minHeight: 84, paddingTop: 12, textAlignVertical: "top" },

  footer: { flexDirection: "row", gap: 10, marginTop: 4 },
  footerButton: { flex: 1 },
});
