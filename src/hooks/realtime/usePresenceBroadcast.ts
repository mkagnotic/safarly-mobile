import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { refreshPresence, trackPresence } from "@/lib/presenceRegistry";

/**
 * Broadcasts the current user's online status via Supabase Realtime Presence.
 * Mount once near the top of the authenticated app tree.
 *
 * Other clients subscribe to `presence:user:{uid}` to render the green "online"
 * dot — see `useConversationPresence`.
 *
 * Web parity (`hooks/usePresenceBroadcast.ts`): web uses `document.visibilitychange`
 * to retrack on tab focus. RN's analogue is `AppState`, which fires `"active"`
 * when the app returns to the foreground.
 */
export function usePresenceBroadcast() {
  const { user } = useAuth();

  useEffect(() => {
    const uid = user?.id;
    if (!uid) return;

    const topic = `presence:user:${uid}`;
    // Through the shared registry so a remount can never open a second channel on
    // a topic this client has already joined. Re-tracking after a reconnect is
    // handled there, by the single subscribe callback.
    const release = trackPresence(topic, uid);

    // Unchanged behaviour: re-announce when the app returns to the foreground.
    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") refreshPresence(topic);
    });

    return () => {
      subscription.remove();
      release();
    };
  }, [user?.id]);
}
