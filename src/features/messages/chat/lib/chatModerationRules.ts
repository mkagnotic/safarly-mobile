/**
 * Chat moderation + match wording and rules, shared by the chat menu, the match
 * banner, the inbox row and the profile menu (flow-18 spec, 28 Oct 2026). Same
 * words and rules as web; one place so the chat and the profile can't drift.
 *
 * Pure (no React Native imports) so node:test can load it.
 */

// ───────── Report ─────────

/** Same body as web's REPORT_SENT_MESSAGE; mobile shows it under a title. */
export const REPORT_SENT_TITLE = "Report sent";
export const REPORT_SENT_BODY = "Our team reviews reports within 24 hours.";
export const REPORT_DUPLICATE_TITLE = "Already reported";
export const REPORT_DUPLICATE_BODY = "You've already reported this — we're on it.";
export const REPORT_SUBTITLE = "Help us keep Safarly safe. Our team reviews every report within 24 hours.";

/**
 * The toast after a report. The server answers `{ duplicate: true }` when the
 * reporter already has a live report on that person; a repeat must not claim a
 * new report was sent (bug 1).
 */
export function reportResultToast(
  duplicate: boolean | undefined,
): { title: string; message: string; variant: "info" | "success" } {
  return duplicate
    ? { title: REPORT_DUPLICATE_TITLE, message: REPORT_DUPLICATE_BODY, variant: "info" }
    : { title: REPORT_SENT_TITLE, message: REPORT_SENT_BODY, variant: "success" };
}

/**
 * Reports are limited to 5 an hour (user decision, 28 Oct 2026). The server
 * answers 429 RATE_LIMITED with its own sentence ("You've sent several reports
 * recently. Please try again later."), which must reach the user as sent - the
 * generic 429 mapping ("Too many attempts…") would replace it.
 */
export function isReportRateLimit(err: unknown): err is { message: string } {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; status?: unknown; message?: unknown };
  return (
    (e.code === "RATE_LIMITED" || e.status === 429) &&
    typeof e.message === "string" &&
    e.message.trim().length > 0
  );
}

/** The sheet's error line: the server's rate-limit sentence as is, else the fallback. */
export function reportErrorText(err: unknown, fallback: (err: unknown) => string): string {
  return isReportRateLimit(err) ? err.message.trim() : fallback(err);
}

// ───────── Block / unblock ─────────

export const BLOCK_CONFIRM_BODY =
  "You won't see each other's listings or be able to message each other. You can unblock them later from their profile.";
export const UNBLOCK_CONFIRM_BODY = "You'll see each other's listings again and be able to message each other.";

/**
 * Only the person who blocked may unblock; legacy blocks with no recorded
 * blocker stay unblockable. Same rule as web matchState.ts `canUnblock`.
 */
export function canUnblockConversation(
  isBlocked: boolean,
  blockedBy: string | null | undefined,
  me: string | null | undefined,
): boolean {
  return isBlocked && (!blockedBy || blockedBy === me);
}

/** The blocked banner's line: the blocker is told how to undo it; the other side gets a neutral line. */
export function blockedBannerBody(canUnblock: boolean, name: string): string {
  return canUnblock
    ? `You blocked ${name}. Unblock them from the menu to message again.`
    : "You can't send messages in this chat.";
}

// ───────── Match handshake ─────────

export const UNMATCH_CONFIRM_BODY =
  "This ends the match for this delivery. Either of you can send a new match request later.";

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || name;
}

export function matchRequestBody(name: string, isBuddy: boolean): string {
  return `${name} requested a match for this ${isBuddy ? "trip" : "delivery"}.`;
}

export function matchWaitingBody(name: string): string {
  return `Match request sent. Waiting for ${firstName(name)} to accept.`;
}

export const MATCH_DECLINED_BODY = "This match was declined. You can send a new request.";
export const MATCH_UNMATCHED_BODY = "You were matched before. Send a new request to reconnect.";

/** The toast after Accept / Send match request (web form). */
export function matchResultToast(theyAskedFirst: boolean, isBuddy: boolean): { title: string } {
  if (!theyAskedFirst) return { title: "Match request sent — waiting for them to accept." };
  return { title: isBuddy ? "You're now travel buddies!" : "Match confirmed!" };
}

/** The one Decline dialog (= web MatchAndDeclineModals). */
export function declineDialogCopy(name: string, requestFromThem: boolean): { title: string; body: string } {
  return requestFromThem
    ? { title: "Decline match request", body: `Decline ${name}'s match request? You can add a reason if you like.` }
    : { title: "Decline match", body: "Are you sure you want to decline? You can add a reason if you like." };
}

/**
 * The chat menu's "Send match request" / "Match again" row. Hidden once I sent
 * the request: a second press is a silent no-op (a benign 409) - bug 9.
 */
export function showMatchRequestRow(matchStatus: string, matchedByMe: boolean): boolean {
  if (matchStatus !== "pending" && matchStatus !== "declined") return false;
  return !matchedByMe;
}

// ───────── Emoji / message cap ─────────

/**
 * Pass MESSAGE_MAX_LENGTH (chatSendRules) as `max`.
 * Append an emoji only if the WHOLE emoji fits under the cap (UTF-16 length, the
 * same as the server's `text.trim().length`); otherwise leave the text as is.
 * Appending blindly let the draft pass 2,000 and the server refused the send.
 */
export function appendWithinCap(prev: string, insert: string, max: number): string {
  return prev.length + insert.length <= max ? prev + insert : prev;
}

/** Cut to the cap without splitting a surrogate pair (a lone half renders as "�"). */
export function capAtCodePoint(text: string, max: number): string {
  if (text.length <= max) return text;
  let end = max;
  const code = text.charCodeAt(end - 1);
  if (code >= 0xd800 && code <= 0xdbff) end -= 1;
  return text.slice(0, end);
}

// ───────── View media ─────────

export const OPEN_FILE_ERROR_TITLE = "Couldn't open the file";
export const OPEN_FILE_ERROR_BODY = "Please try again.";

/** Items with no link can't be opened, so they are not shown or counted (= web). */
export function openableMedia<T extends { attachment_url: string | null }>(items: readonly T[]): T[] {
  return items.filter((m) => typeof m.attachment_url === "string" && m.attachment_url.length > 0);
}
