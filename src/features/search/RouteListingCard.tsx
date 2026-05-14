import { type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { colors } from "@/theme/colors";

interface Props {
  /** Route, e.g. "Chennai → Chicago". */
  title: string;
  /** Date band, e.g. "Apr 18, 2026 – Apr 18, 2026". Web shows the same string. */
  dateLabel: string;
  /** Optional airline tag shown next to the date. */
  airline?: string | null;
  /** Right-side meta tag, e.g. "Your trip" / "Parcel · electronics". */
  metaRight?: string;
  /** Nested matches (or empty-state message) rendered below the divider. */
  children: ReactNode;
}

/**
 * Header card for the user's own listing in auto-match mode. Mirrors web's
 * `RouteListingCard` from CustomerSearch — title + date + airline tag, then a
 * divider, then the matched results nested inside.
 */
export function RouteListingCard({
  title,
  dateLabel,
  airline,
  metaRight,
  children,
}: Readonly<Props>) {
  return (
    <Card style={styles.card}>
      <Text style={styles.title} numberOfLines={2}>
        {title}
      </Text>
      <View style={styles.metaRow}>
        <View style={styles.metaItem}>
          <Ionicons name="calendar-outline" size={13} color={colors.primary} />
          <Text style={styles.metaText}>{dateLabel}</Text>
        </View>
        {airline ? (
          <>
            <View style={styles.metaSep} />
            <View style={styles.metaItem}>
              <Ionicons name="airplane-outline" size={13} color={colors.primary} />
              <Text style={styles.metaText}>{airline}</Text>
            </View>
          </>
        ) : null}
      </View>
      {metaRight ? <Text style={styles.metaRightText}>{metaRight}</Text> : null}
      <View style={styles.divider} />
      <View>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 12, gap: 8 },
  title: { color: colors.text, fontSize: 16, fontWeight: "800", lineHeight: 22 },
  metaRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 8 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 5 },
  metaText: { color: colors.mutedText, fontSize: 13 },
  metaSep: { width: 1, height: 14, backgroundColor: colors.border },
  metaRightText: { color: colors.mutedText, fontSize: 11, fontWeight: "600", letterSpacing: 0.3 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border, marginVertical: 8 },
});
