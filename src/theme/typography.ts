import { Platform } from "react-native";

/**
 * Default UI stack used by most native-style apps: SF on iOS, Roboto (sans-serif) on Android,
 * and the usual system-ui stack on web (same idea as React Navigation’s built-in theme fonts).
 */
const WEB_FONT_STACK =
  'system-ui, "Segoe UI", Roboto, Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol"';

export const defaultFontFamily =
  Platform.select({
    ios: "System",
    android: "sans-serif",
    web: WEB_FONT_STACK,
    default: "sans-serif",
  }) ?? "sans-serif";

/**
 * Dynamic Type cap for compact controls inside a fixed row: filter chips, unit
 * toggles, count badges. iOS's largest STANDARD text size is ~1.35x; past that
 * (the Accessibility sizes) these pill labels would push their row off screen.
 * Body text is NOT capped - layouts around it wrap or scroll instead.
 */
export const COMPACT_CONTROL_MAX_FONT_SCALE = 1.35;
