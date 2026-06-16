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

export interface RateBuddyValues {
  score: number;
  review: string;
}

interface Props {
  open: boolean;
  buddyName: string;
  pending: boolean;
  onCancel: () => void;
  onSubmit: (values: RateBuddyValues) => void;
}

export function RateBuddyModal({
  open,
  buddyName,
  pending,
  onCancel,
  onSubmit,
}: Readonly<Props>) {
  const [score, setScore] = useState(0);
  const [review, setReview] = useState("");
  const wasOpenRef = useRef(false);

  // Reset on open-transition only.
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
        if (!pending) onCancel();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!pending) onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.center} pointerEvents="box-none">
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.title}>Rate {buddyName}</Text>
            <Pressable
              onPress={onCancel}
              hitSlop={8}
              disabled={pending}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={20} color={colors.mutedText} />
            </Pressable>
          </View>

          <Text style={styles.label}>How was your experience?</Text>
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
                  size={34}
                  color={n <= score ? colors.warning : colors.subtleText}
                />
              </Pressable>
            ))}
          </View>
          {score > 0 ? <Text style={styles.scoreLabel}>{STAR_LABELS[score - 1]}</Text> : null}

          <Text style={[styles.label, styles.reviewLabel]}>
            Review <Text style={styles.labelMuted}>(Optional)</Text>
          </Text>
          <TextInput
            value={review}
            onChangeText={setReview}
            placeholder="Share a few words about your trip together…"
            placeholderTextColor={colors.subtleText}
            style={[styles.input, styles.textarea]}
            multiline
            numberOfLines={3}
            textAlignVertical="top"
            editable={!pending}
          />

          <View style={styles.footer}>
            <AppButton
              label="Cancel"
              variant="secondary"
              onPress={onCancel}
              disabled={pending}
              style={styles.footerButton}
            />
            <AppButton
              label={pending ? "Submitting…" : "Submit rating"}
              onPress={handleSubmit}
              disabled={pending || score <= 0}
              gradientColors={[colors.ctaAccent, colors.ctaAccent]}
              leftIcon={
                pending ? <ActivityIndicator size="small" color={colors.white} /> : undefined
              }
              style={styles.footerButton}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 18 },
  card: {
    width: "100%",
    maxWidth: 440,
    borderRadius: 22,
    backgroundColor: colors.card,
    padding: 20,
    gap: 14,
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: colors.text, fontSize: 20, lineHeight: 26, fontWeight: "800" },

  label: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  labelMuted: { color: colors.subtleText, fontWeight: "500" },
  reviewLabel: { marginTop: 4 },
  starsRow: { flexDirection: "row", gap: 10, justifyContent: "center", paddingVertical: 4 },
  scoreLabel: {
    color: colors.warning,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "800",
    textAlign: "center",
  },

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
