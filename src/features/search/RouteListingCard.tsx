import { type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { Card } from "@/components/ui/Card";
import { MetricRow, MetricTile, RouteHeader } from "@/features/search/routeBlocks";
import { colors } from "@/theme/colors";

interface Props {
  fromCity: string;
  toCity: string;
  /** Connector icon — airplane for trips, cube for parcels. */
  kind: "trip" | "parcel";
  /** Date band, e.g. "Apr 18, 2026 – Apr 18, 2026". */
  dateLabel: string;
  /** Optional second metric tile (e.g. AIRLINE / CATEGORY). */
  secondary?: { label: string; value: string };
  /** Nested matches (or empty-state message) rendered below the divider. */
  children: ReactNode;
}

/**
 * Header card for the user's own listing in auto-match mode. Renders the
 * exact same route + metric layout as `TripDetailsScreen.TripCard` via the
 * shared `RouteHeader` / `MetricTile` primitives in `routeBlocks`.
 */
export function RouteListingCard({
  fromCity,
  toCity,
  kind,
  dateLabel,
  secondary,
  children,
}: Readonly<Props>) {
  return (
    <Card style={styles.card}>
      <RouteHeader fromCity={fromCity} toCity={toCity} kind={kind} />
      <MetricRow>
        <MetricTile label="DATE" value={dateLabel} />
        {secondary ? (
          <MetricTile label={secondary.label} value={secondary.value} highlight />
        ) : null}
      </MetricRow>
      <View style={styles.divider} />
      <View>{children}</View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, marginBottom: 14, gap: 14 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: colors.border },
});
