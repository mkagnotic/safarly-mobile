import { useCallback, useMemo, useState } from "react";

import type { useAuth } from "@/context/AuthContext";
import { type Conversation } from "@/services/api";

import { inboxChipCounts } from "./inboxPaging";
import { type InboxFilter } from "./inboxTypes";

/**
 * Search + filter chips over the inbox, split into the two sections the list
 * shows: match requests on top, then everything else.
 */
export function useInboxFilters({
  conversations,
  user,
  hasMore = false,
  serverTotal,
  serverUnreadChats,
}: {
  conversations: Conversation[];
  user: ReturnType<typeof useAuth>["user"];
  /** The list is paged and more threads remain on the server. */
  hasMore?: boolean;
  /** Server-side counts over ALL pages (see `inboxChipCounts`). */
  serverTotal?: number | null;
  serverUnreadChats?: number | null;
}) {
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<InboxFilter>("all");

  // Web parity: search filters by participant name + last message preview.
  const searched = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return conversations;
    return conversations.filter((c) => {
      const name = (c.participant?.name ?? "").toLowerCase();
      const preview = (c.last_message ?? c.last_message_text ?? "").toLowerCase();
      return name.includes(needle) || preview.includes(needle);
    });
  }, [conversations, search]);

  const isAwaitingMine = useCallback(
    (c: Conversation) =>
      c.match_status === "pending" && !!c.matched_by && c.matched_by !== user?.id,
    [user?.id],
  );

  const filtered = useMemo(() => {
    if (filter === "unread") return searched.filter((c) => (c.unread_count ?? 0) > 0);
    if (filter === "requests") return searched.filter(isAwaitingMine);
    return searched;
  }, [searched, filter, isAwaitingMine]);

  // "unread" is unread CHATS (threads), not messages — the chip says so.
  const counts = useMemo(
    () => ({
      ...inboxChipCounts({
        loadedAll: conversations.length,
        loadedUnread: conversations.filter((c) => (c.unread_count ?? 0) > 0).length,
        hasMore,
        serverTotal: serverTotal ?? undefined,
        serverUnreadChats: serverUnreadChats ?? undefined,
      }),
      requests: conversations.filter(isAwaitingMine).length,
    }),
    [conversations, isAwaitingMine, hasMore, serverTotal, serverUnreadChats],
  );

  const requestRows = useMemo(() => filtered.filter(isAwaitingMine), [filtered, isAwaitingMine]);
  const otherRows = useMemo(
    () => filtered.filter((c) => !isAwaitingMine(c)),
    [filtered, isAwaitingMine],
  );

  // Two-section layout: Match requests on top, then everything else.
  const sectionedData = useMemo<Conversation[]>(
    () => [...requestRows, ...otherRows],
    [requestRows, otherRows],
  );

  return { search, setSearch, filter, setFilter, counts, requestRows, otherRows, sectionedData };
}
