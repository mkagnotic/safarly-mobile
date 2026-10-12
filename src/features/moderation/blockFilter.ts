/**
 * Pure helpers behind "blocked users' content disappears" (App Store guideline
 * 1.2). Kept free of `@/` imports so `node --test` can load them directly.
 *
 * Blocking is mutual for visibility: the set to hide is everyone I blocked
 * PLUS everyone who blocked me. Only browse surfaces (search, opportunities,
 * match suggestions, incoming buddy requests) are filtered — never the
 * viewer's own listings, bookings or conversations, so a deal already under way
 * with that person stays reachable.
 */

export interface BlockLists {
  blocked_user_ids?: readonly string[] | null;
  blocked_by_user_ids?: readonly string[] | null;
}

/** Every user id whose content the viewer must not see. */
export function buildHiddenUserIds(lists: BlockLists | null | undefined): Set<string> {
  const out = new Set<string>();
  for (const id of lists?.blocked_user_ids ?? []) if (id) out.add(id);
  for (const id of lists?.blocked_by_user_ids ?? []) if (id) out.add(id);
  return out;
}

type OwnerIds = string | null | undefined | readonly (string | null | undefined)[];

/** True when any of the item's owner ids is hidden. Missing ids never hide. */
export function isHiddenOwner(owner: OwnerIds, hidden: ReadonlySet<string>): boolean {
  if (hidden.size === 0) return false;
  const ids = Array.isArray(owner) ? owner : [owner];
  return ids.some((id) => typeof id === "string" && id !== "" && hidden.has(id));
}

/**
 * Drop items owned by a hidden user. Returns the SAME array when nothing is
 * hidden (or nothing matched), so memoised lists don't re-render for nothing.
 */
export function withoutBlocked<T>(
  items: readonly T[],
  hidden: ReadonlySet<string>,
  ownerOf: (item: T) => OwnerIds,
): T[] {
  if (hidden.size === 0) return items as T[];
  const kept = items.filter((item) => !isHiddenOwner(ownerOf(item), hidden));
  return kept.length === items.length ? (items as T[]) : kept;
}

/** Optimistic list edits for block / unblock. Never duplicates an id. */
export function addId(ids: readonly string[], id: string): string[] {
  return ids.includes(id) ? [...ids] : [...ids, id];
}

export function removeId(ids: readonly string[], id: string): string[] {
  return ids.filter((x) => x !== id);
}

interface PersonRef {
  id?: string | null;
}

/**
 * Who posted a search package row. A carrier trip belongs to its carrier; a
 * receive request (a parcel) to its sender - a parcel's `carrier` is whoever
 * later took it, not its author, so it must not hide the row.
 */
export function packageMatchOwnerIds(m: {
  type?: string;
  carrier?: PersonRef | null;
  sender?: PersonRef | null;
  carrier_id?: string | null;
  sender_id?: string | null;
  user_id?: string | null;
}): (string | null | undefined)[] {
  return m.type === "receive_request"
    ? [m.sender?.id, m.sender_id]
    : [m.carrier?.id, m.carrier_id, m.user_id];
}

/** Who sent a buddy request (the receiver is the viewer). */
export function buddyRequestSenderIds(r: {
  requester_id?: string | null;
  sender_id?: string | null;
  requester?: PersonRef | null;
  user_profiles?: PersonRef | null;
}): (string | null | undefined)[] {
  return [r.requester_id, r.sender_id, r.requester?.id, r.user_profiles?.id];
}
