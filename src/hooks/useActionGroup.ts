import { useRef, useState } from "react";

/** Anything that reports "I am running": a hook's pending flag, or a boolean. */
type BusySource = boolean | { isPending: boolean } | null | undefined;

export interface ActionGroup {
  /**
   * True while ANY action in the group is running. Bind to `disabled` on EVERY
   * button in the group — that is the whole point of the group.
   */
  busy: boolean;
  /** Key of the action currently running, or null. */
  activeKey: string | null;
  /** True only for the action that actually fired — bind to its spinner. */
  isRunning: (key: string) => boolean;
  /**
   * Run an action under a synchronous lock. A second press while anything in the
   * group is running is DROPPED, not queued. The promise resolves to
   * `undefined` if the action was dropped or threw; the caller's own
   * error handling (toast) still runs inside `fn`.
   */
  run: <T>(key: string, fn: () => Promise<T> | T) => Promise<T | undefined>;
}

/**
 * Mutually-exclusive actions, disabled as a set. Mirror of web's
 * `hooks/useActionGroup.ts` — keep the two in sync.
 *
 * The problem this exists for: a card offering Accept / Counter / Decline used
 * to track one `pending` boolean per action, so while Accept was in flight the
 * other two stayed pressable and sent a second, contradictory command for a
 * decision the server had already taken.
 *
 * Two layers, deliberately:
 *  1. `busy` — declarative, drives `disabled` on every sibling, including
 *     actions fired from a modal this group doesn't own.
 *  2. the lock inside `run` — synchronous, so it drops a second press landing
 *     before React has re-rendered with the new `disabled`. On a phone that is
 *     not hypothetical: a double-tap is ~120ms apart and RN re-renders are not
 *     guaranteed to land in between.
 *
 * ```tsx
 * const actions = useActionGroup();
 * <Pressable disabled={actions.busy} onPress={() => actions.run("accept", handleAccept)}>
 *   {actions.isRunning("accept") ? <ActivityIndicator /> : <Text>Accept</Text>}
 * </Pressable>
 * ```
 */
export function useActionGroup(sources: Record<string, BusySource> = {}): ActionGroup {
  const [localKey, setLocalKey] = useState<string | null>(null);
  const lockRef = useRef(false);

  let externalKey: string | null = null;
  for (const [key, source] of Object.entries(sources)) {
    const pending = typeof source === "boolean" ? source : !!source?.isPending;
    if (pending) {
      externalKey = key;
      break;
    }
  }

  const activeKey = localKey ?? externalKey;
  const busy = activeKey !== null;

  // Deliberately NOT memoised: it closes over the CURRENT `busy` so it can also
  // refuse a press while a sibling action fired outside `run` is in flight.
  const run = async <T,>(key: string, fn: () => Promise<T> | T): Promise<T | undefined> => {
    if (lockRef.current || busy) return undefined;
    lockRef.current = true;
    setLocalKey(key);
    try {
      return await fn();
    } catch {
      return undefined;
    } finally {
      lockRef.current = false;
      setLocalKey(null);
    }
  };

  return {
    busy,
    activeKey,
    isRunning: (key: string) => activeKey === key,
    run,
  };
}

export default useActionGroup;
