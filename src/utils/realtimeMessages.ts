/**
 * Pure state updates for a chat thread's realtime events.
 *
 * They return the SAME array when an event changes nothing. Realtime UPDATE
 * events arrive for rows this screen never loaded and for writes that leave a
 * row as it was (read receipts re-stamped, our own echo); building a new array
 * for each one re-rendered the thread and everything derived from it. Under a
 * burst of events that cascade tripped React's "Maximum update depth exceeded"
 * and blanked the screen (found on an Android release build, 2026-10-12).
 */

interface Row {
  id: string;
}

/** Append a newly inserted row unless it is already in the list. */
export function applyMessageInsert<T extends Row>(prev: T[], incoming: Partial<T> | undefined): T[] {
  if (!incoming?.id) return prev;
  if (prev.some((m) => m.id === incoming.id)) return prev;
  return [...prev, incoming as T];
}

/** Merge an updated row into the list; unchanged lists keep their identity. */
export function applyMessageUpdate<T extends Row>(prev: T[], updated: Partial<T> | undefined): T[] {
  if (!updated?.id) return prev;
  const index = prev.findIndex((m) => m.id === updated.id);
  if (index === -1) return prev;
  const current = prev[index];
  const changed = (Object.keys(updated) as (keyof T)[]).some((key) => current[key] !== updated[key]);
  if (!changed) return prev;
  const next = prev.slice();
  next[index] = { ...current, ...updated };
  return next;
}
