import { useEffect } from "react";
import { AppState } from "react-native";

import { useAuth } from "@/context/AuthContext";
import { supabase } from "@/integrations/supabase/client";

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

    const channel = supabase.channel(`presence:user:${uid}`, {
      config: { presence: { key: uid } },
    });

    channel.subscribe((status) => {
      if (status === "SUBSCRIBED") {
        // Fire-and-forget. The promise rejects only if the channel is closed
        // before the track lands, which we don't need to surface to the UI.
        void channel.track({ online_at: new Date().toISOString() });
      }
    });

    const subscription = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void channel.track({ online_at: new Date().toISOString() });
      }
    });

    return () => {
      subscription.remove();
      void channel.untrack().catch(() => {});
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);
}
