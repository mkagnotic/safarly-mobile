/**
 * Route-match catch-up (web useMatchPrompt port, 29 Oct 2026). The live banner
 * only reaches people who are online when a match notice is created; someone
 * who was away would only see a dot. So ONE banner announces matches the user
 * has not been told about yet - keyed on "already told", never on "unread", or
 * the same old matches were re-announced on every start. Pure, for node --test.
 */
export const MATCH_KINDS: ReadonlySet<string> = new Set(["route_match", "route_match_summary"]);
/** Cap the remembered set so it cannot grow without bound on a long-lived device. */
export const MAX_REMEMBERED = 200;

export const MATCH_PROMPT_COPY = {
  title: "🎯 You have new route matches",
  message: "Someone matches your route and dates — tap to see them.",
  /** Web's toast button; the app's banner opens on tap. */
  action: "View matches",
} as const;

/** Same key per user as web's localStorage (`safarly:match-prompted:{uid}`). */
export function matchPromptedKey(userId: string): string {
  return `safarly:match-prompted:${userId}`;
}

export function isMatchNotice(data: { kind?: string } | null | undefined): boolean {
  return !!data?.kind && MATCH_KINDS.has(data.kind);
}

/** Unread match notices the user has never been told about. */
export function freshMatchIds(
  list: readonly { id: string; read?: boolean; data?: { kind?: string } | null }[],
  prompted: ReadonlySet<string>,
): string[] {
  return list.filter((n) => !n.read && isMatchNotice(n.data) && !prompted.has(n.id)).map((n) => n.id);
}

/** The remembered set after adding `ids`, deduped and capped (oldest dropped). */
export function nextPrompted(prompted: Iterable<string>, ids: readonly string[]): string[] {
  return [...new Set([...prompted, ...ids])].slice(-MAX_REMEMBERED);
}
