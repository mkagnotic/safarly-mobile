import { Ionicons } from "@expo/vector-icons";

import type { LookingForType, SearchCountry } from "@/features/search/searchPersistence";
import { formatLocalDate } from "@/utils/travelDate";

/** Per-side country for the route filter — independent, so IN -> IN is reachable. */
export const COUNTRY_LABEL: Record<SearchCountry, string> = { IN: "India", US: "USA" };
export const COUNTRY_FLAG: Record<SearchCountry, string> = { IN: "🇮🇳", US: "🇺🇸" };

type NoticeVariant = "error" | "info" | "success" | "warning";
export interface Notice {
  message: string;
  title?: string;
  variant: NoticeVariant;
}

export const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Local-midnight ISO "YYYY-MM-DD" (avoids UTC day-shift). */
function isoDay(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
/** Web parity: search dates are bounded to today … +12 months. */
export function searchDateBounds(): { todayIso: string; maxIso: string } {
  const today = new Date();
  const max = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
  return { todayIso: isoDay(today), maxIso: isoDay(max) };
}

/** Web parity: 3/day cap, 10 per manual page (auto-match uses 50). */
export const MANUAL_PER_PAGE = 10;

/** Default view: everything on the marketplace, paged. */
export const BROWSE_QUERY = { per_page: MANUAL_PER_PAGE } as const;
/** Opt-in lens: only listings that fit the user's own trips and parcels. */
export const MATCH_MY_ROUTES_QUERY = { per_page: 50, match_my_routes: true } as const;
/** Client-side page sizes for auto-match lists (mirrors web). */
export const AUTO_PER_PAGE = 5;
export const AUTO_BUDDY_PER_PAGE = 10;

interface LookingForOption {
  value: LookingForType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

export const LOOKING_FOR_OPTIONS: readonly LookingForOption[] = [
  { value: "travel_buddy", label: "Travel Buddy", icon: "people-outline" },
  { value: "carrier", label: "Carrier", icon: "car-sport" },
  { value: "receive_request", label: "Receive Request", icon: "mail-outline" },
] as const;

export function formatDateLabel(iso: string | null | undefined): string {
  // `travel_date` is a date-only column — never `new Date()`. See formatLocalDate.
  return formatLocalDate(iso, { month: "short", day: "numeric", year: "numeric" });
}

export function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
