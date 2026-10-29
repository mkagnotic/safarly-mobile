import { messagesApi } from "@/services/api";
import { refreshUnreadInboxCount } from "@/hooks/api/useUnreadInboxCount";
import { bumpRealtimeTopic } from "@/store/realtimeBus";

/**
 * The chat on screen saw new messages: tell the server, then recount the Inbox tab
 * badge and the bell (which drives the app-icon badge). The server also clears the
 * chat's notifications. Same as web `src/features/messages/lib/markOpenThreadRead.ts`;
 * when it is called is `chat/lib/readRules.ts`. Best effort: never throws.
 */
export async function markOpenThreadRead(conversationId: string): Promise<void> {
  try {
    await messagesApi.markRead(conversationId);
  } catch {
    // The next open of the thread marks it read anyway.
  }
  refreshUnreadInboxCount();
  bumpRealtimeTopic("notifications");
}

/** After the thread itself was fetched (which marks it read): recount the same badges. */
export function recountAfterThreadRead(): void {
  refreshUnreadInboxCount();
  bumpRealtimeTopic("notifications");
}
