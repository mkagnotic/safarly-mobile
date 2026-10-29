import AsyncStorage from "@react-native-async-storage/async-storage";

import { matchPromptedKey, nextPrompted } from "./matchPromptRules";

/** The match notices this user has already been told about (AsyncStorage, per user). */
export async function loadPrompted(userId: string): Promise<Set<string>> {
  try {
    const raw = await AsyncStorage.getItem(matchPromptedKey(userId));
    return new Set(raw ? (JSON.parse(raw) as string[]) : []);
  } catch {
    return new Set();
  }
}

/** Remembers `ids` as told; the live banner calls this too, so catch-up never repeats it. */
export async function rememberPrompted(userId: string, ids: readonly string[]): Promise<void> {
  if (ids.length === 0) return;
  try {
    const prompted = await loadPrompted(userId);
    await AsyncStorage.setItem(matchPromptedKey(userId), JSON.stringify(nextPrompted(prompted, ids)));
  } catch {
    /* storage unavailable - worst case the catch-up repeats once */
  }
}
