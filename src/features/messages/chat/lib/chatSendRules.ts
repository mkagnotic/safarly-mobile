/**
 * How a failed chat send is reported - ONE signal per failure (chat spec,
 * 28 Oct 2026, bugs 9 and 10):
 *  - the UPLOAD failed: no bubble; the composer keeps the file ("Upload failed -
 *    tap retry") and the typed caption goes back in the input. That preview is
 *    the only retry.
 *  - the SEND failed: only the failed bubble ("Not sent · Retry · Discard"). No
 *    toast, no draft restore - restoring it let the same text go twice.
 *  - a refusal a retry cannot fix (VALIDATION_ERROR, e.g. a phone number or a
 *    too-long message): the server's reason, the text back in the composer, no
 *    retry bubble.
 *
 * Pure (no React Native imports) so node:test can load it.
 */

/** Product decision (28 Oct 2026): same cap on web, mobile and the server. */
export const MESSAGE_MAX_LENGTH = 2000;
/** The counter appears only once the draft is this long. */
export const MESSAGE_COUNTER_FROM = 1800;
export const MESSAGE_TOO_LONG_TEXT = "Messages can be up to 2,000 characters.";

const fmt = (n: number) => n.toLocaleString("en-US");

/** "1,850/2,000" from 1,800 characters on; null below that. */
export function messageCounter(length: number): string | null {
  if (length < MESSAGE_COUNTER_FROM) return null;
  return `${fmt(length)}/${fmt(MESSAGE_MAX_LENGTH)}`;
}

export type SendPhase = "upload" | "send";

/** Thrown by `useChatMessages.send` so the composer knows which step failed. */
export class ChatSendError extends Error {
  readonly phase: SendPhase;
  readonly original: unknown;
  readonly code: string | null;
  constructor(phase: SendPhase, cause: unknown) {
    super(cause instanceof Error ? cause.message : String(cause ?? "Send failed"));
    this.name = "ChatSendError";
    this.phase = phase;
    this.original = cause;
    const code = (cause as { code?: unknown } | null)?.code;
    this.code = typeof code === "string" ? code : null;
    Object.setPrototypeOf(this, ChatSendError.prototype);
  }
}

/** A refusal that sending again would only repeat. */
export function isPermanentRefusal(code: string | null | undefined): boolean {
  return code === "VALIDATION_ERROR";
}

/** The server's length refusal, in the app's words. */
export function isTooLongRefusal(code: string | null | undefined, message: string | null | undefined): boolean {
  if (code !== "VALIDATION_ERROR") return false;
  const m = (message ?? "").toLowerCase();
  return /2,?000/.test(m) || m.includes("too long") || m.includes("characters");
}

export interface SendFailurePlan {
  /** Keep a failed bubble with Retry · Discard. */
  keepBubble: boolean;
  /** Put the typed text back in the composer. */
  restoreDraft: boolean;
  /** Keep the file in the composer preview, marked "Upload failed - tap retry". */
  keepFile: boolean;
  /** A notice to show (the server's reason), or null for none. */
  notice: string | null;
}

export function sendFailurePlan(input: {
  phase: SendPhase;
  hadFile: boolean;
  code: string | null | undefined;
  message: string | null | undefined;
}): SendFailurePlan {
  if (isPermanentRefusal(input.code)) {
    return {
      keepBubble: false,
      restoreDraft: true,
      keepFile: input.hadFile,
      notice: isTooLongRefusal(input.code, input.message) ? MESSAGE_TOO_LONG_TEXT : input.message || "Couldn't send",
    };
  }
  if (input.phase === "upload") {
    return { keepBubble: false, restoreDraft: true, keepFile: true, notice: null };
  }
  // The file (if any) is already uploaded and rides on the bubble.
  return { keepBubble: true, restoreDraft: false, keepFile: false, notice: null };
}

export interface PendingRetryItem {
  text: string;
  attachment_url: string | null;
  attachment_type: string | null;
  attachment_name?: string | null;
}

export const ATTACHMENT_PLACEHOLDER_TEXT = "📎 Attachment";

/**
 * What the failed bubble's Retry sends: its text and, when the file was
 * uploaded, the attachment WITH its name. Null when there is nothing to send
 * (a row without text or an uploaded file - the server would refuse it).
 */
export function retryPayload(item: PendingRetryItem): {
  text: string;
  attachment?: { url: string; type: string; name?: string };
} | null {
  const text = item.text === ATTACHMENT_PLACEHOLDER_TEXT ? "" : item.text;
  const attachment = item.attachment_url && item.attachment_type
    ? { url: item.attachment_url, type: item.attachment_type, ...(item.attachment_name ? { name: item.attachment_name } : {}) }
    : undefined;
  if (!text.trim() && !attachment) return null;
  return attachment ? { text, attachment } : { text };
}
