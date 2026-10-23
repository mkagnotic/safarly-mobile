import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import type { RealtimeChannel } from "@supabase/supabase-js";

import { supabase } from "@/integrations/supabase/client";

import { isDeadChannelStatus, reconnectDelayMs } from "./resilientChannel";

/**
 * Keep a realtime channel alive across iOS backgrounding and socket drops - see
 * `resilientChannel.ts` for why. `build` returns the channel with its `.on(...)`
 * handlers attached, NOT yet subscribed. `onRecover` re-fetches whatever the
 * owner shows, after a rebuild and on every return to the foreground.
 *
 * `key` identifies the subscription: a new key (another conversation, another
 * user) tears the old channel down. `build` and `onRecover` are read through
 * refs, so they may change on every render without resubscribing.
 */
export function useResilientChannel(
  key: string | null,
  build: () => RealtimeChannel,
  onRecover: () => void,
): void {
  const buildRef = useRef(build);
  buildRef.current = build;
  const recoverRef = useRef(onRecover);
  recoverRef.current = onRecover;

  useEffect(() => {
    if (!key) return;
    let disposed = false;
    let channel: RealtimeChannel | null = null;
    let attempt = 0;
    let retry: ReturnType<typeof setTimeout> | null = null;
    let recovering = false;

    const connect = () => {
      if (disposed) return;
      const ch = buildRef.current();
      channel = ch;
      ch.subscribe((status) => {
        if (disposed || channel !== ch) return;
        if (status === "SUBSCRIBED") {
          attempt = 0;
          // Back after a drop: catch up on what was sent while it was down.
          if (recovering) {
            recovering = false;
            recoverRef.current();
          }
        } else if (isDeadChannelStatus(status)) {
          scheduleRebuild();
        }
      });
    };

    const scheduleRebuild = () => {
      if (disposed || retry) return;
      recovering = true;
      retry = setTimeout(() => {
        retry = null;
        if (disposed) return;
        const old = channel;
        channel = null;
        if (old) void supabase.removeChannel(old);
        attempt += 1;
        connect();
      }, reconnectDelayMs(attempt));
    };

    connect();

    const sub = AppState.addEventListener("change", (state) => {
      if (state !== "active" || disposed) return;
      // Anything sent while the app was in the background never arrived.
      recoverRef.current();
      if (channel && channel.state !== "joined") scheduleRebuild();
    });

    return () => {
      disposed = true;
      if (retry) clearTimeout(retry);
      sub.remove();
      if (channel) void supabase.removeChannel(channel);
    };
  }, [key]);
}
