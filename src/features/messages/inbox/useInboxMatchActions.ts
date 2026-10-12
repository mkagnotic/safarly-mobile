import { useCallback, useState } from "react";

import type { useAuth } from "@/context/AuthContext";
import { showToast } from "@/feedback/appFeedback";
import { type UseMyConversationsResult } from "@/hooks/api/useMyConversations";
import { getErrorMessage, type Conversation } from "@/services/api";

import { getRoleForConversation } from "./inboxHelpers";

/** Accept / decline a match request straight from an inbox row. */
export function useInboxMatchActions({
  user,
  acceptMatch,
  declineMatch,
}: {
  user: ReturnType<typeof useAuth>["user"];
  acceptMatch: UseMyConversationsResult["acceptMatch"];
  declineMatch: UseMyConversationsResult["declineMatch"];
}) {
  // Track which conversation triggered each modal — null when closed. Two
  // separate slots so accept and decline can coexist without race conditions.
  const [acceptTarget, setAcceptTarget] = useState<Conversation | null>(null);
  const [declineTarget, setDeclineTarget] = useState<Conversation | null>(null);
  const [acceptPending, setAcceptPending] = useState(false);
  const [declinePending, setDeclinePending] = useState(false);

  // Web parity: opening a match request from the inbox routes through the
  // MatchConfirmationModal so the user must acknowledge responsibilities
  // before the optimistic accept fires.
  const openAccept = useCallback((c: Conversation) => setAcceptTarget(c), []);
  const openDecline = useCallback((c: Conversation) => setDeclineTarget(c), []);

  const handleAcceptConfirm = useCallback(async () => {
    if (!acceptTarget) return;
    setAcceptPending(true);
    try {
      // Read off the PRE-accept row: if they had already asked, mine is the
      // second acceptance and the deal is matched. If I'm first, all I've done
      // is send the request — saying "Matched" there was simply wrong.
      const theyAskedFirst = !!acceptTarget.matched_by && acceptTarget.matched_by !== user?.id;
      await acceptMatch(acceptTarget.id);
      setAcceptTarget(null);
      showToast({
        title: theyAskedFirst ? "Matched" : "Match request sent",
        message: theyAskedFirst ? undefined : "Waiting for them to accept.",
        variant: "success",
        duration: 1800,
      });
    } catch (err) {
      showToast({
        title: "Couldn't accept",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setAcceptPending(false);
    }
  }, [acceptTarget, acceptMatch, user?.id]);

  const handleDeclineConfirm = useCallback(
    async (reason: string) => {
      if (!declineTarget) return;
      setDeclinePending(true);
      try {
        await declineMatch(declineTarget.id, reason || undefined);
        setDeclineTarget(null);
        showToast({ title: "Match declined", variant: "info", duration: 1800 });
      } catch (err) {
        showToast({
          title: "Couldn't decline",
          message: getErrorMessage(err),
          variant: "error",
        });
      } finally {
        setDeclinePending(false);
      }
    },
    [declineTarget, declineMatch],
  );

  const acceptUserRole = acceptTarget
    ? getRoleForConversation(acceptTarget, user?.id ?? null)
    : "sender";

  return {
    acceptTarget,
    setAcceptTarget,
    declineTarget,
    setDeclineTarget,
    acceptPending,
    declinePending,
    openAccept,
    openDecline,
    handleAcceptConfirm,
    handleDeclineConfirm,
    acceptUserRole,
  };
}
