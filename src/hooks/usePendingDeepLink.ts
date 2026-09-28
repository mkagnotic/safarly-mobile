import { useEffect } from "react";
import { getStateFromPath } from "@react-navigation/native";

import { consumePendingDeepLink, linking, pathFromDeepLink } from "@/navigation/linking";
import { navigationRef } from "@/navigation/navigationRef";

/**
 * Replays a cold-start deep link once the navigator can reach its destination.
 *
 * `linking.getInitialURL` parks the URL and returns null so the first render is
 * never blocked — see the note there for why waiting instead deadlocks the
 * splash screen. This is the other half: when `ready` flips true, the target
 * stack is mounted, so the parked path can finally be resolved and applied.
 *
 * Runs at most once per launch; `consumePendingDeepLink` clears the URL as it
 * hands it over, so a later re-render cannot yank the user off whatever screen
 * they have since navigated to.
 */
export function usePendingDeepLink(ready: boolean): void {
  useEffect(() => {
    if (!ready || !navigationRef.isReady()) return;

    const url = consumePendingDeepLink();
    if (!url) return;

    const path = pathFromDeepLink(url);
    if (!path) return;

    const state = getStateFromPath(path, linking.config);
    // An unrecognised path resolves to nothing — leave the user on the default
    // screen rather than resetting the navigator to an empty state.
    if (state) navigationRef.reset(state);
  }, [ready]);
}
