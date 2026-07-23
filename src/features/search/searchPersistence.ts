import AsyncStorage from "@react-native-async-storage/async-storage";

import type { SearchFilters } from "@/services/api";

/** Per-side country of the route pickers. */
export type SearchCountry = "IN" | "US";
/** The three "Looking for" facets. */
export type LookingForType = "travel_buddy" | "carrier" | "receive_request";
/** Which result tab is active. */
export type ResultsTab = "package" | "buddy" | "receiver";

/**
 * Snapshot of the Search screen's in-progress state, persisted so leaving and
 * returning to the tab restores the exact filters, tab, and page you left on —
 * web parity (web keeps this in `sessionStorage`). Restore is read-only: it
 * never re-consumes search quota (the quota unit was already spent when the
 * search was first applied; replaying it is a free GET).
 */
export interface PersistedSearch {
  v: 1;
  fromCountry: SearchCountry;
  toCountry: SearchCountry;
  fromCity: string;
  toCity: string;
  dateFrom: string;
  dateTo: string;
  lookingFor: LookingForType[];
  activeTab: ResultsTab;
  /** null = auto-match mode; object = restored manual search. */
  appliedFilters: SearchFilters | null;
  pkgPage: number;
  rcvPage: number;
  buddyPage: number;
  autoPkgPage: number;
  autoRcvPage: number;
  autoBuddyPage: number;
}

const KEY = "safarly.searchState.v1";

/** Load the persisted search snapshot, or null if absent/corrupt. */
export async function loadPersistedSearch(): Promise<PersistedSearch | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PersistedSearch;
    if (parsed?.v !== 1) return null; // ignore older/unknown shapes
    return parsed;
  } catch {
    return null;
  }
}

/** Persist the search snapshot. Best-effort; failures are swallowed. */
export async function savePersistedSearch(snapshot: PersistedSearch): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* non-critical — a failed persist just means no restore next time */
  }
}

/** Clear the persisted snapshot (used by "Clear filters"). */
export async function clearPersistedSearch(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}
