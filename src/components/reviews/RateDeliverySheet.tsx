import { Ionicons } from "@expo/vector-icons";
import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import { Avatar } from "@/components/ui/Avatar";
import { RATING_COPY, REVIEW_MAX, SCORE_LABELS } from "@/features/bookings/lib/ratingCopy";
import { KeyboardLift } from "@/components/ui/KeyboardLift";
import { colors } from "@/theme/colors";

const MAX_REVIEW = REVIEW_MAX; // web parity (RateDeliveryDialog)

export interface RateDeliveryValues {
  score: number;
  review: string;
}

interface Props {
  open: boolean;
  /** Counterparty being rated (carrier or sender). */
  ratedUserName: string;
  ratedUserAvatarUrl?: string | null;
  /** Identity check approved: tick on the avatar (web dialog parity). */
  ratedUserVerified?: boolean;
  /** "Carrier" / "Receiver" - who they are to the viewer. */
  roleLabel?: string | null;
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
  ratedUserAvatarUrl,
  ratedUserVerified,
  roleLabel,
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
      statusBarTranslucent
      navigationBarTranslucent
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onDismiss();
      }}
    >
      {/* A Modal's window is not resized for the keyboard on either platform
          (edge-to-edge on Android), so lift the card ourselves; the card scrolls once it no longer fits. */}
      <KeyboardLift style={styles.flex}>
        <Pressable
          style={styles.backdrop}
          onPress={() => {
            if (!pending) onDismiss();
          }}
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
        />
        <View style={styles.center} pointerEvents="box-none">
          {/* "handled": a tap outside the multiline review dismisses the keyboard. */}
          <ScrollView
            style={styles.card}
            contentContainerStyle={styles.cardContent}
            keyboardShouldPersistTaps="handled"
            bounces={false}
          >
            <View style={styles.header}>
              <View style={styles.headerIcon}>
                <Ionicons name="star" size={20} color={colors.warning} />
              </View>
              <View style={styles.headerText}>
                <Text style={styles.title}>{RATING_COPY.title}</Text>
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

            {/* Who is being rated, as on web's dialog: avatar + tick, role, route. */}
            <View style={styles.partyRow}>
              <Avatar name={ratedUserName} uri={ratedUserAvatarUrl} size={40} verified={ratedUserVerified} />
              <View style={styles.partyText}>
                <Text style={styles.partyName} numberOfLines={1}>{ratedUserName}</Text>
                {roleLabel || routeSummary ? (
                  <Text style={styles.routeText} numberOfLines={1}>
                    {[roleLabel, routeSummary].filter(Boolean).join(" - ")}
                  </Text>
                ) : null}
              </View>
            </View>

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
            <Text style={styles.scoreLabel}>{score > 0 ? SCORE_LABELS[score] : RATING_COPY.tapHint}</Text>

            <Text style={styles.reviewLabel}>{RATING_COPY.reviewLabel}</Text>
            <TextInput
              value={review}
              onChangeText={(t) => setReview(t.slice(0, MAX_REVIEW))}
              placeholder={RATING_COPY.reviewPlaceholder}
              placeholderTextColor={colors.subtleText}
              style={[styles.input, styles.textarea]}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              editable={!pending}
              maxLength={MAX_REVIEW}
            />
            <Text style={styles.counter}>
              {review.length}/{MAX_REVIEW}
            </Text>

            <View style={styles.footer}>
              <AppButton
                label={RATING_COPY.later}
                variant="secondary"
                onPress={onDismiss}
                disabled={pending}
                style={styles.footerButton}
              />
              <AppButton
                label={pending ? RATING_COPY.submitting : RATING_COPY.submit}
                onPress={handleSubmit}
                disabled={pending || score <= 0}
                gradientColors={[colors.ctaAccent, colors.ctaAccent]}
                leftIcon={pending ? <ActivityIndicator size="small" color={colors.white} /> : undefined}
                style={styles.footerButton}
              />
            </View>
          </ScrollView>
        </View>
      </KeyboardLift>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.45)" },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 18,
    paddingVertical: 24,
  },
  card: {
    width: "100%",
    maxWidth: 440,
    flexGrow: 0,
    borderRadius: 22,
    backgroundColor: colors.card,
  },
  cardContent: { padding: 20, gap: 14 },
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

  partyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    padding: 10,
    borderRadius: 14,
    backgroundColor: colors.surfaceMuted,
  },
  partyText: { flex: 1, minWidth: 0, gap: 2 },
  partyName: { color: colors.text, fontSize: 14, fontWeight: "800" },
  routeText: { color: colors.mutedText, fontSize: 12, fontWeight: "600" },

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
  counter: { color: colors.mutedText, fontSize: 11, textAlign: "right", marginTop: -6 },
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
