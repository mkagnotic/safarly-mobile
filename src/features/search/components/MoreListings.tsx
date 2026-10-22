import { useEffect, useState, type ReactNode } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { AppButton } from "@/components/ui/AppButton";
import {
  moreListingsLabel,
  othersShareRoute,
  type MoreListingsKind,
} from "@/features/search/lib/matchDedupe";
import { colors } from "@/theme/colors";

/**
 * "+N more parcels on this route" under a person's card: their other matching
 * listings, collapsed by default (client, 22 Oct 2026 - the one-card-per-person
 * list used to hide them). Opens by itself when the deep-linked listing is one of
 * them, so the highlight lands on a visible row. Same words as web.
 */
export function MoreListings<T extends { id: string; from_city: string; to_city: string }>({
  primary,
  others,
  kind,
  highlightId,
  renderRow,
}: Readonly<{
  primary: { from_city: string; to_city: string };
  others: T[];
  kind: MoreListingsKind;
  highlightId?: string;
  /** One row per extra listing; `showRoute` = its route differs from the card's. */
  renderRow: (listing: T, showRoute: boolean) => ReactNode;
}>) {
  const highlightInside = !!highlightId && others.some((o) => o.id === highlightId);
  const [open, setOpen] = useState(highlightInside);
  // A later notification can target a listing on a card that is already shown.
  useEffect(() => {
    if (highlightInside) setOpen(true);
  }, [highlightInside, highlightId]);
  if (others.length === 0) return null;
  const label = open ? "Show less" : moreListingsLabel(others.length, kind, othersShareRoute(primary, others));
  return (
    <View style={styles.wrap}>
      <Pressable
        onPress={() => setOpen((v) => !v)}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        style={styles.toggle}
      >
        <Ionicons name={open ? "chevron-up" : "chevron-down"} size={14} color={colors.primary} />
        <Text style={styles.toggleText}>{label}</Text>
      </Pressable>
      {open ? (
        <View style={styles.rows}>
          {others.map((o) => (
            <View key={o.id}>
              {renderRow(o, o.from_city !== primary.from_city || o.to_city !== primary.to_city)}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

/**
 * One extra listing: its dates and details on one line, and the card's own
 * Start chat for it.
 */
export function MoreListingRow({
  title,
  detail,
  highlighted,
  chatStarting,
  disabled,
  onStartChat,
}: Readonly<{
  title: string;
  detail?: string | null;
  highlighted?: boolean;
  chatStarting: boolean;
  disabled?: boolean;
  onStartChat: () => void | Promise<unknown>;
}>) {
  return (
    <View style={[styles.row, highlighted && styles.rowHighlighted]}>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={2}>
          {title}
        </Text>
        {detail ? (
          <Text style={styles.rowDetail} numberOfLines={2}>
            {detail}
          </Text>
        ) : null}
      </View>
      <AppButton
        label={chatStarting ? "Starting…" : "Start chat"}
        onPress={onStartChat}
        disabled={chatStarting || disabled}
        gradientColors={[colors.ctaAccent, colors.ctaAccent]}
        style={styles.rowButton}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    paddingTop: 10,
    gap: 8,
  },
  toggle: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start" },
  toggleText: { color: colors.primary, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  rows: { gap: 8 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: colors.card,
  },
  rowHighlighted: { borderWidth: 2, borderColor: colors.primary, backgroundColor: colors.primarySoft },
  rowText: { flex: 1, minWidth: 0 },
  rowTitle: { color: colors.text, fontSize: 13, lineHeight: 18, fontWeight: "700" },
  rowDetail: { color: colors.mutedText, fontSize: 12, lineHeight: 16, fontWeight: "500", marginTop: 2 },
  rowButton: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 12 },
});
