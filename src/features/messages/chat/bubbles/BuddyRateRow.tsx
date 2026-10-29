import { Ionicons } from "@expo/vector-icons";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { RateBuddyModal, type RateBuddyValues } from "@/features/buddies/RateBuddyModal";
import { useBuddyConnections } from "@/hooks/api/useBuddyConnections";
import { getErrorMessage, ratingsApi } from "@/services/api";
import { colors } from "@/theme/colors";

/**
 * The "Journey completed — you can now rate each other" line in a buddy chat,
 * with the rating one tap away.
 *
 * Client, 25 Oct 2026: the chat told both buddies to rate each other and then
 * offered nothing to tap - the rating lived only in My Travels. The connection's
 * own `can_rate` / `already_rated` (the same answer My Travels uses) decides the
 * button, so a rated trip says "Rated" instead of asking again. Web parity:
 * src/features/messages/components/BuddyRateCard.tsx.
 */
export function BuddyRateRow({ text, connectionId }: Readonly<{ text: string; connectionId: string }>) {
  const { connections, refetch } = useBuddyConnections();
  const conn = connections.find((c) => c.id === connectionId) ?? null;
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (values: RateBuddyValues) => {
    if (!conn?.buddy?.id) return;
    setPending(true);
    setError(null);
    try {
      await ratingsApi.rateBuddy({
        connection_id: conn.id,
        rated_user_id: conn.buddy.id,
        score: values.score,
        review: values.review || undefined,
      });
      await refetch();
      setOpen(false);
    } catch (err) {
      setError(`Couldn't submit rating. ${getErrorMessage(err)}`);
    } finally {
      setPending(false);
    }
  };

  return (
    <View style={styles.row}>
      <View style={styles.card}>
        <View style={styles.line}>
          <Ionicons name="airplane" size={13} color={colors.primary} />
          <Text style={styles.text}>{text}</Text>
        </View>
        {conn?.already_rated ? (
          <View style={styles.rated}>
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.ratedText}>Rated</Text>
          </View>
        ) : conn?.can_rate ? (
          <Pressable
            onPress={() => setOpen(true)}
            style={styles.btn}
            accessibilityRole="button"
            accessibilityLabel="Rate your buddy"
          >
            <Ionicons name="star" size={13} color={colors.warning} />
            <Text style={styles.btnText}>Rate your buddy</Text>
          </Pressable>
        ) : null}
        {error ? <Text style={styles.error}>{error}</Text> : null}
      </View>
      {open && conn ? (
        <RateBuddyModal
          open
          buddyName={conn.buddy?.name ?? "Traveler"}
          fromCity={conn.from_city}
          toCity={conn.to_city}
          pending={pending}
          onCancel={() => {
            if (!pending) setOpen(false);
          }}
          onSubmit={submit}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { alignItems: "center", paddingHorizontal: 24, marginVertical: 8 },
  card: {
    alignItems: "center",
    gap: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(93, 63, 211, 0.28)",
    backgroundColor: "rgba(93, 63, 211, 0.06)",
    paddingHorizontal: 14,
    paddingVertical: 10,
    maxWidth: "100%",
  },
  line: { flexDirection: "row", alignItems: "center", gap: 6, flexShrink: 1 },
  text: { color: colors.text, fontSize: 13, lineHeight: 18, textAlign: "center", flexShrink: 1 },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    minHeight: 36,
    backgroundColor: "rgba(245, 158, 11, 0.15)",
  },
  btnText: { color: colors.text, fontSize: 13, fontWeight: "800" },
  rated: { flexDirection: "row", alignItems: "center", gap: 4 },
  ratedText: { color: colors.subtleText, fontSize: 12, fontWeight: "700" },
  error: { color: colors.danger, fontSize: 12, textAlign: "center" },
});
