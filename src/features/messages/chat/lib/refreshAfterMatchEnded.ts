import { bumpRealtimeTopic } from "@/store/realtimeBus";

import { MATCH_ENDED_TOPICS } from "./matchEndedTopics";

/**
 * The refresh after a match ends, shared by the manual Unmatch and the
 * automatic unmatch on the final verification rejection, so the chat banner,
 * the workflow pin and every listing screen move together. Awaited by callers
 * that keep a button busy until the screen has the new state.
 */
export async function refreshAfterMatchEnded(
  refetchConversations: () => Promise<unknown>,
  refetchActiveDeal: () => Promise<unknown>,
): Promise<void> {
  for (const t of MATCH_ENDED_TOPICS) bumpRealtimeTopic(t);
  await Promise.all([refetchConversations(), refetchActiveDeal()]);
}
