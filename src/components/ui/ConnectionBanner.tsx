import { useEffect, useRef, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { useConnectionStatus } from "@/hooks/useConnectionStatus";
import { colors } from "@/theme/colors";
import {
  BACK_ONLINE_MS,
  RECONNECT_GRACE_MS,
  bannerVariant,
  stepBackOnline,
  type BackOnlineState,
  type BannerTone,
} from "@/utils/connectionStatus";

const TONE: Record<BannerTone, string> = {
  danger: colors.danger,
  warning: colors.warning,
  safe: colors.safe,
};

/**
 * Web `ConnectionBanner` parity: a slim pill pinned near the top of the screen
 * ("You're offline" / "Reconnecting…" / "Back online"), same words, timings
 * and roles as web. It sits under the status bar, never over the tab bar or a
 * bottom composer, and never takes a touch (`pointerEvents="none"`). Mounted
 * only in the signed-in app (like web's CustomerLayout).
 */
export function ConnectionBanner() {
  const status = useConnectionStatus();
  const insets = useSafeAreaInsets();
  const [reconnectingVisible, setReconnectingVisible] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);
  const backOnlineRef = useRef<BackOnlineState>({ wasDegraded: false });
  const hideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 1 s grace before "Reconnecting…", so blips and the first connect never flash.
  useEffect(() => {
    if (status !== "reconnecting") {
      setReconnectingVisible(false);
      return;
    }
    const t = setTimeout(() => setReconnectingVisible(true), RECONNECT_GRACE_MS);
    return () => clearTimeout(t);
  }, [status]);

  // "Back online" only after a degradation the user actually saw. The hide
  // timer lives in a ref and is cleared only by a new drop or unmount - a re-run
  // of this effect (reconnectingVisible flipping false right after status turns
  // online) must not cancel it, or the pill never clears (emulator, 29 Oct 2026).
  useEffect(() => {
    const step = stepBackOnline(backOnlineRef.current, status, reconnectingVisible);
    backOnlineRef.current = step.next;
    if (step.hide) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
      setShowBackOnline(false);
    }
    if (step.show) {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      setShowBackOnline(true);
      hideTimerRef.current = setTimeout(() => {
        hideTimerRef.current = null;
        setShowBackOnline(false);
      }, BACK_ONLINE_MS);
    }
  }, [status, reconnectingVisible]);

  useEffect(
    () => () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
    },
    [],
  );

  const variant = bannerVariant({ status, reconnectingVisible, showBackOnline });
  if (!variant) return null;
  const tint = TONE[variant.tone];

  return (
    <View pointerEvents="none" style={[styles.wrap, { top: insets.top + 6 }]}>
      <View
        accessible
        accessibilityRole={variant.role === "alert" ? "alert" : "text"}
        accessibilityLiveRegion={variant.role === "alert" ? "assertive" : "polite"}
        accessibilityLabel={variant.label}
        style={[styles.pill, { borderColor: `${tint}73` }]}
      >
        <View style={[StyleSheet.absoluteFill, styles.tint, { backgroundColor: `${tint}1F` }]} />
        {variant.tone === "warning" ? (
          <ActivityIndicator size="small" color={tint} style={styles.spinner} />
        ) : (
          <Ionicons
            name={variant.tone === "danger" ? "cloud-offline-outline" : "checkmark-circle-outline"}
            size={14}
            color={tint}
          />
        )}
        <Text style={[styles.label, { color: tint }]} numberOfLines={1} maxFontSizeMultiplier={1.35}>
          {variant.label}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    alignItems: "center",
    zIndex: 40,
    elevation: 40,
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    maxWidth: "100%",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 999,
    borderWidth: 1,
    overflow: "hidden",
    backgroundColor: colors.card,
    shadowColor: "#000",
    shadowOpacity: 0.08,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 1 },
  },
  tint: { borderRadius: 999 },
  spinner: { transform: [{ scale: 0.7 }], width: 14, height: 14 },
  label: { fontSize: 12, fontWeight: "600", flexShrink: 1 },
});
