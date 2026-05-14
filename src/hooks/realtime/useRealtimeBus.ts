import { useEffect, useRef } from "react";

import { useRealtimeBusStore, type RealtimeTopic } from "@/store/realtimeBus";

/**
 * Subscribe a list-style hook to a realtime topic. When `useRealtimeSync`
 * receives a server-side change for that topic, the consuming hook's
 * `refetch` runs.
 *
 *   useEffect(() => void refetch(), [refetch]);            // initial load
 *   useRealtimeBus("conversations", refetch);              // realtime delta
 *
 * The first render does NOT trigger a refetch — the topic counter hasn't
 * changed yet, so the dependency-array check no-ops. That keeps the initial
 * load owned by the existing `useEffect(() => refetch())` in each hook and
 * avoids double-fetches on screen mount.
 */
export function useRealtimeBus(topic: RealtimeTopic, refetch: () => Promise<unknown> | unknown) {
  const tick = useRealtimeBusStore((s) => s.ticks[topic]);
  const baselineRef = useRef(tick);
  const refetchRef = useRef(refetch);

  // Keep the ref pointing at the latest refetch so we don't have to put a
  // changing function in the effect deps (and miss a tick during the
  // micro-window between renders).
  refetchRef.current = refetch;

  useEffect(() => {
    if (tick === baselineRef.current) return;
    baselineRef.current = tick;
    void refetchRef.current();
  }, [tick]);
}
