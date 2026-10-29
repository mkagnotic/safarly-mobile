import { useEffect, useState } from "react";
import NetInfo from "@react-native-community/netinfo";

import { supabase } from "@/integrations/supabase/client";
import { resolveConnectionStatus, type ConnectionStatus } from "@/utils/connectionStatus";

/**
 * Web `useConnectionStatus` parity: NetInfo (network + reachability) and the
 * Supabase realtime socket, combined by the pure `resolveConnectionStatus`.
 * The socket is polled every 2.5 s, the same cadence as web.
 */
export function useConnectionStatus(): ConnectionStatus {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(null);
  const [realtimeOpen, setRealtimeOpen] = useState(false);
  const [hasConnected, setHasConnected] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);
      setIsInternetReachable(state.isInternetReachable ?? null);
    });

    const checkRealtime = () => {
      try {
        const state = (supabase.realtime as unknown as { connectionState?: () => string }).connectionState?.();
        const open = state === "open";
        setRealtimeOpen(open);
        if (open) setHasConnected(true);
      } catch {
        setRealtimeOpen(false);
      }
    };
    checkRealtime();
    const id = setInterval(checkRealtime, 2500);

    return () => {
      unsubscribe();
      clearInterval(id);
    };
  }, []);

  return resolveConnectionStatus({ isConnected, isInternetReachable, realtimeOpen, hasConnected });
}
