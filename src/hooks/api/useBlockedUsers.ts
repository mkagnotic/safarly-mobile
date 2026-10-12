import { useCallback, useEffect, useMemo } from "react";
import { create } from "zustand";

import { useAuth } from "@/context/AuthContext";
import { addId, buildHiddenUserIds, removeId } from "@/features/moderation/blockFilter";
import { moderationApi } from "@/services/api";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

/** A screen mounting after this long re-reads the lists; sooner reuses them. */
const STALE_MS = 60_000;

interface BlockedUsersState {
  /** Whose lists these are. A different signed-in user resets them. */
  ownerId: string | null;
  blockedByMe: string[];
  blockedMe: string[];
  fetchedAt: number;
  /** Bumped per request so a stale response can't overwrite a newer one. */
  requestSeq: number;
}

/**
 * One shared copy for every screen. Unlike the per-screen list hooks, this set
 * is read by search, opportunities, match suggestions, buddy requests and the
 * detail screens at once — so it lives in a tiny zustand store (not persisted:
 * it is re-read on launch) and a block on one screen hides the person
 * everywhere without a refetch per list.
 */
const useBlockedUsersStore = create<BlockedUsersState>(() => ({
  ownerId: null,
  blockedByMe: [],
  blockedMe: [],
  fetchedAt: 0,
  requestSeq: 0,
}));

/** The read already under way, so screens mounting together share one request. */
let inFlight: { ownerId: string; seq: number; promise: Promise<void> } | null = null;

/** Makes any read already under way discard its (now outdated) answer. */
function invalidateReads() {
  useBlockedUsersStore.setState((s) => ({ requestSeq: s.requestSeq + 1 }));
}

function fetchBlocks(ownerId: string, force = false): Promise<void> {
  const current = useBlockedUsersStore.getState().requestSeq;
  if (!force && inFlight && inFlight.ownerId === ownerId && inFlight.seq === current) {
    return inFlight.promise;
  }
  const seq = current + 1;
  useBlockedUsersStore.setState({ requestSeq: seq });
  const promise = readBlocks(ownerId, seq);
  inFlight = { ownerId, seq, promise };
  return promise;
}

async function readBlocks(ownerId: string, seq: number): Promise<void> {
  try {
    const res = await moderationApi.getBlocks();
    const now = useBlockedUsersStore.getState();
    if (now.ownerId !== ownerId || now.requestSeq !== seq) return;
    useBlockedUsersStore.setState({
      blockedByMe: res.data?.blocked_user_ids ?? [],
      blockedMe: res.data?.blocked_by_user_ids ?? [],
      fetchedAt: Date.now(),
    });
  } catch {
    // Fail open: keep what we had (nothing, on a first load). Showing a blocked
    // person's listing for a while is recoverable; a list that errors is not.
  } finally {
    if (inFlight?.seq === seq) inFlight = null;
  }
}

export interface UseBlockedUsersResult {
  /** Everyone whose content to hide: people I blocked ∪ people who blocked me. */
  hiddenUserIds: ReadonlySet<string>;
  isBlockedByMe: (userId: string | null | undefined) => boolean;
  /** Optimistic; throws (after reverting) when the server refuses. */
  block: (userId: string) => Promise<void>;
  /** Optimistic; throws (after reverting) when the server refuses. */
  unblock: (userId: string) => Promise<void>;
  refetch: () => Promise<void>;
}

/**
 * App-wide block list (`GET /moderation-handler/blocks`). Never throws on read
 * and never holds a screen on a spinner — until the lists arrive, nothing is
 * hidden.
 */
export function useBlockedUsers(): UseBlockedUsersResult {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const ownerId = useBlockedUsersStore((s) => s.ownerId);
  const blockedByMe = useBlockedUsersStore((s) => s.blockedByMe);
  const blockedMe = useBlockedUsersStore((s) => s.blockedMe);

  // Account switch (or sign-out) drops the previous person's lists before the
  // new ones load; otherwise a re-mount only re-reads when the copy is stale.
  useEffect(() => {
    const state = useBlockedUsersStore.getState();
    if (state.ownerId !== userId) {
      useBlockedUsersStore.setState({
        ownerId: userId,
        blockedByMe: [],
        blockedMe: [],
        fetchedAt: 0,
      });
    } else if (Date.now() - state.fetchedAt < STALE_MS) {
      return;
    }
    if (userId) void fetchBlocks(userId);
  }, [userId]);

  const refetch = useCallback(async () => {
    if (userId) await fetchBlocks(userId, true);
  }, [userId]);

  const block = useCallback(
    async (target: string) => {
      // A read that started before the block would answer without it.
      invalidateReads();
      const before = useBlockedUsersStore.getState().blockedByMe;
      useBlockedUsersStore.setState({ blockedByMe: addId(before, target) });
      try {
        await moderationApi.block(target);
      } catch (err) {
        if (!before.includes(target)) {
          useBlockedUsersStore.setState((s) => ({ blockedByMe: removeId(s.blockedByMe, target) }));
        }
        throw err;
      }
      // A block also closes any chat with them; let the inbox catch up.
      bumpRealtimeTopic("conversations");
      void refetch();
    },
    [refetch],
  );

  const unblock = useCallback(
    async (target: string) => {
      invalidateReads();
      const before = useBlockedUsersStore.getState().blockedByMe;
      useBlockedUsersStore.setState({ blockedByMe: removeId(before, target) });
      try {
        await moderationApi.unblock(target);
      } catch (err) {
        if (before.includes(target)) {
          useBlockedUsersStore.setState((s) => ({ blockedByMe: addId(s.blockedByMe, target) }));
        }
        throw err;
      }
      bumpRealtimeTopic("conversations");
      void refetch();
    },
    [refetch],
  );

  // Lists left over from another account are never applied, even for the one
  // render before the effect above resets them.
  const current = ownerId === userId;
  const hiddenUserIds = useMemo(
    () =>
      current
        ? buildHiddenUserIds({ blocked_user_ids: blockedByMe, blocked_by_user_ids: blockedMe })
        : new Set<string>(),
    [current, blockedByMe, blockedMe],
  );

  const isBlockedByMe = useCallback(
    (id: string | null | undefined) => current && !!id && blockedByMe.includes(id),
    [current, blockedByMe],
  );

  return { hiddenUserIds, isBlockedByMe, block, unblock, refetch };
}
