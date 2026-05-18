import { useEffect, useState } from "react";
import { useAppStore } from "@/store/useAppStore";

/**
 * `true` once zustand-persist has finished rehydrating the store from
 * AsyncStorage. Routing must wait for this: AsyncStorage loads asynchronously,
 * so before hydration the store still holds pre-rehydration defaults
 * (`onboarded: false`, `authenticated: false`, …). Deciding the navigation
 * stack from those would flash or skip the wrong screen on a returning user.
 */
export function useStoreHydrated(): boolean {
  const [hydrated, setHydrated] = useState<boolean>(() => useAppStore.persist.hasHydrated());

  useEffect(() => {
    // Hydration may have completed between the initial render and this effect.
    if (useAppStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }
    // onFinishHydration returns its own unsubscribe fn (zustand v5).
    return useAppStore.persist.onFinishHydration(() => setHydrated(true));
  }, []);

  return hydrated;
}
