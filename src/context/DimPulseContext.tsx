import { createContext, useContext, useEffect, useRef, type PropsWithChildren } from "react";
import { AccessibilityInfo, Animated, Easing, Platform } from "react-native";
import { glassDimPulse } from "@/theme/colors";

const DimPulseContext = createContext<Animated.Value | null>(null);

/** Drives the same breathing dim on every `Screen` and the bottom tab bar. */
export function DimPulseProvider({ children }: Readonly<PropsWithChildren>) {
  const dimPulse = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let loop: Animated.CompositeAnimation | null = null;
    let cancelled = false;

    const start = () => {
      loop = Animated.loop(
        Animated.sequence([
          Animated.timing(dimPulse, {
            toValue: 1,
            duration: glassDimPulse.durationMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
          Animated.timing(dimPulse, {
            toValue: 0,
            duration: glassDimPulse.durationMs,
            easing: Easing.inOut(Easing.sin),
            useNativeDriver: true,
          }),
        ])
      );
      loop.start();
    };

    let prefersReducedMotionWeb = false;
    if (Platform.OS === "web" && typeof globalThis !== "undefined" && "matchMedia" in globalThis) {
      try {
        prefersReducedMotionWeb = globalThis.matchMedia("(prefers-reduced-motion: reduce)").matches;
      } catch {
        prefersReducedMotionWeb = false;
      }
    }

    if (Platform.OS === "web") {
      if (!prefersReducedMotionWeb && !cancelled) start();
    } else {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((reduce) => {
          if (!cancelled && !reduce) start();
        })
        .catch(() => {
          if (!cancelled) start();
        });
    }

    return () => {
      cancelled = true;
      loop?.stop();
      dimPulse.setValue(0);
    };
  }, [dimPulse]);

  return <DimPulseContext.Provider value={dimPulse}>{children}</DimPulseContext.Provider>;
}

export function useDimPulse(): Animated.Value {
  const v = useContext(DimPulseContext);
  if (v == null) {
    throw new Error("useDimPulse must be used within DimPulseProvider");
  }
  return v;
}
