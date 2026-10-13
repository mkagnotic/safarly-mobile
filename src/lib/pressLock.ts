/**
 * Synchronous double-tap guard for buttons.
 *
 * `disabled`/`loading` only take effect after the next render, so two quick
 * taps could both get through and, say, create the same listing twice. The
 * lock is taken synchronously on the first press and released when the
 * handler's promise settles - or after `fallbackMs` when the handler returns
 * nothing (most callers `void` their async work).
 */
export interface PressLock {
  /** Run `onPress` unless a previous press is still holding the lock. Returns false when ignored. */
  press(onPress: () => void | Promise<unknown>): boolean;
  readonly locked: boolean;
}

export function createPressLock(
  fallbackMs: number,
  schedule: (fn: () => void, ms: number) => unknown = setTimeout,
): PressLock {
  let locked = false;
  const unlock = () => {
    locked = false;
  };
  return {
    get locked() {
      return locked;
    },
    press(onPress) {
      if (locked) return false;
      locked = true;
      let result: void | Promise<unknown>;
      try {
        result = onPress();
      } catch (err) {
        unlock();
        throw err;
      }
      if (result && typeof (result as Promise<unknown>).finally === "function") {
        (result as Promise<unknown>).finally(unlock).catch(() => {});
      } else {
        schedule(unlock, fallbackMs);
      }
      return true;
    },
  };
}
