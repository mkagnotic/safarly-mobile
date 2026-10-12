/**
 * Inbox paging and chip counts — pure, so `node --test` can fence them.
 *
 * The inbox is paged (`INBOX_PAGE_SIZE` threads per page, the same on web).
 * Before 13 October neither platform could reach past the first page: web
 * loaded 20, mobile 50, and a thread beyond that could never be opened — so
 * its unread messages, which the tab badge counts, could never be cleared.
 * The chips counted the loaded page only.
 *
 * Web mirror: `nextConversationsPage` / `flattenConversationPages` in
 * `src/hooks/api/useMessages.ts` and `totals` in `useInboxConversations.ts`.
 */

export const INBOX_PAGE_SIZE = 50;

/** The list endpoint's `meta`. `total` is the real number of visible threads
 *  (all pages); `summary.unread_chats` the number with anything unread. */
export interface ConversationsMeta {
  page: number;
  per_page: number;
  total: number;
  summary?: { unread_chats?: number };
}

/** Is there another page after `meta`'s? By the server's real total — never by
 *  "the page came back full", which asks for an empty page forever. */
export function hasMorePages(meta: ConversationsMeta | undefined | null): boolean {
  if (!meta || !meta.per_page) return false;
  return meta.page * meta.per_page < meta.total;
}

/** Concatenate loaded pages, keeping the first copy of any thread that moved
 *  between pages while paging (a new message lifts it to the top). */
export function mergePages<T extends { id: string }>(pages: readonly (readonly T[])[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const page of pages) {
    for (const row of page) {
      if (seen.has(row.id)) continue;
      seen.add(row.id);
      out.push(row);
    }
  }
  return out;
}

/**
 * The "All" and "Unread chats" chip numbers.
 *
 * Unit: THREADS. The tab badge counts unread MESSAGES, which is why the chip
 * reads "Unread chats" — "Unread 1" under a badge of 3 looked like a bug.
 *
 * Until every page is loaded the loaded rows undercount, so the server's
 * number wins; once everything is in, the local rows are exact and move the
 * instant a thread is opened (the optimistic read).
 */
export function inboxChipCounts(args: {
  loadedAll: number;
  loadedUnread: number;
  hasMore: boolean;
  serverTotal?: number;
  serverUnreadChats?: number;
}): { all: number; unread: number } {
  const { loadedAll, loadedUnread, hasMore, serverTotal, serverUnreadChats } = args;
  if (!hasMore) return { all: loadedAll, unread: loadedUnread };
  return {
    all: Math.max(serverTotal ?? 0, loadedAll),
    unread: Math.max(serverUnreadChats ?? 0, loadedUnread),
  };
}
