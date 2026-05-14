import type { AppLanguage } from "@/i18n/translations";

export type AppTimeFormat = "12h" | "24h";
export type AppTimeZone = "America/New_York" | "Europe/Paris" | "America/Mexico_City" | "Asia/Kolkata";

export const LANGUAGE_OPTIONS: ReadonlyArray<{ value: AppLanguage; label: string }> = [
  { value: "en-US", label: "English (US)" },
  { value: "fr-CA", label: "Francais (CA)" },
  { value: "es-US", label: "Espanol (US)" },
];

export const TIMEZONE_OPTIONS: ReadonlyArray<{ value: AppTimeZone; label: string }> = [
  { value: "America/New_York", label: "America/New York" },
  { value: "Europe/Paris", label: "Europe/Paris" },
  { value: "America/Mexico_City", label: "America/Mexico City" },
  { value: "Asia/Kolkata", label: "Asia/Kolkata" },
];
