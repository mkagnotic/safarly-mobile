import { Platform, type ViewStyle } from "react-native";

const VIOLET = "#12081E";

/** Primary floating panels (cards, list rows) on the glass gradient */
export function shadowCard(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: "0 6px 20px rgba(18, 8, 42, 0.08), 0 2px 8px rgba(18, 8, 42, 0.05)",
    };
  }
  if (Platform.OS === "android") {
    return { elevation: 3 };
  }
  return {
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
  };
}

/** Dark hero strips (wallet balance, brand cards) */
export function shadowHero(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: "0 8px 24px rgba(6, 2, 18, 0.24), 0 3px 10px rgba(6, 2, 18, 0.16)",
    };
  }
  if (Platform.OS === "android") {
    return { elevation: 5 };
  }
  return {
    shadowColor: "#050208",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 14,
  };
}

/** Search fields, pills, secondary panels */
export function shadowSoft(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: "0 2px 10px rgba(18, 8, 42, 0.05), 0 1px 3px rgba(18, 8, 42, 0.03)",
    };
  }
  if (Platform.OS === "android") {
    return { elevation: 2 };
  }
  return {
    shadowColor: VIOLET,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
  };
}

/** Circular FABs and floating icon buttons */
export function shadowFab(): ViewStyle {
  if (Platform.OS === "web") {
    return {
      boxShadow: "0 8px 24px rgba(88, 72, 168, 0.35), 0 2px 8px rgba(18, 8, 42, 0.15)",
    };
  }
  if (Platform.OS === "android") {
    return { elevation: 8 };
  }
  return {
    shadowColor: "#5A4A8A",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  };
}
