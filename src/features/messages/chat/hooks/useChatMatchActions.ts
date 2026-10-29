import { useCallback, useState } from "react";

import { showToast } from "@/feedback/appFeedback";
import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";
import { type UseMyConversationsResult } from "@/hooks/api/useMyConversations";
import { useActionGroup } from "@/hooks/useActionGroup";
import { type useModalHandoff } from "@/hooks/useModalHandoff";
import {
  ApiClientError,
  getErrorMessage,
  type Conversation,
  type MatchCandidate,
} from "@/services/api";

import { type ChatUser, type SetChatModalError } from "../chatTypes";
import { matchResultToast } from "../lib/chatModerationRules";

interface UseChatMatchActionsInput {
  conversationId: string | null;
  conversation: Conversation | null;
  user: ChatUser;
  matchableDeal: UseActiveDealResult["activeDeal"];
  acceptMatch: UseMyConversationsResult["acceptMatch"];
  declineMatch: UseMyConversationsResult["declineMatch"];
  refetchActiveDeal: UseActiveDealResult["refetch"];
  afterChildModal: ReturnType<typeof useModalHandoff>["after"];
  setModalError: SetChatModalError;
}

/**
 * The match handshake: accept / match again (with the deal picker when the
 * server refuses to guess between deliveries) and decline.
 */
export function useChatMatchActions({
  conversationId,
  conversation,
  user,
  matchableDeal,
  acceptMatch,
  declineMatch,
  refetchActiveDeal,
  afterChildModal,
  setModalError,
}: UseChatMatchActionsInput) {
  // Set only when the server refuses to choose between several deliveries in common.
  const [matchCandidates, setMatchCandidates] = useState<MatchCandidate[] | null>(null);
  const [declineOpen, setDeclineOpen] = useState(false);
  // Accept / decline / match-again are one decision, so they run through one
  // group: `busy` locks every entry point (banner, pin, both modals) and the
  // lock inside `run` drops a second tap landing before React re-renders with
  // the new `disabled`. Same primitive as web's `hooks/useActionGroup.ts`.
  const matchActions = useActionGroup();
  const matchPending = matchActions.isRunning("accept");
  const decliningPending = matchActions.isRunning("decline");
  const matchBusy = matchActions.busy;
  const [matchModalOpen, setMatchModalOpen] = useState(false);

  const handleAccept = useCallback(async () => {
    if (!conversationId) return;
    // Read off the PRE-accept snapshot: if they had already asked, mine is the
    // second acceptance and the deal is now matched. If I am first, all I have
    // done is send the request - saying "Matched" there was simply wrong.
    const theyAskedFirst = !!conversation?.matched_by && conversation.matched_by !== user?.id;
    setModalError(null);
    await matchActions.run("accept", async () => {
      try {
        await acceptMatch(conversationId, {
          parcel_id: matchableDeal?.parcel_id ?? undefined,
          trip_id: matchableDeal?.trip_id ?? undefined,
        });
        // Awaited: the pinned bar is a projection of the server FSM, so hold
        // the confirm button busy until it HAS the next step. Ending the
        // pending state as soon as the PUT returned re-enabled the button under
        // a banner still showing the old step - which is what invited a second
        // press.
        await refetchActiveDeal();
        setMatchModalOpen(false);
        // Web's words: "Match confirmed!" / "Match request sent — waiting for them to accept."
        showToast({
          ...matchResultToast(theyAskedFirst, conversation?.context_type === "buddy"),
          variant: "success",
          duration: 1800,
        });
      } catch (err) {
        // The pair have more than one delivery in common and nothing named which one.
        // The server refuses instead of guessing - whichever rule it used would be
        // right for one person's intent and wrong for another's - and hands back the
        // candidates, so ask rather than reporting a failure.
        if (err instanceof ApiClientError && err.code === "MATCH_AMBIGUOUS") {
          const candidates = (err.details ?? []) as MatchCandidate[];
          if (candidates.length) {
            afterChildModal(
              () => setMatchModalOpen(false),
              () => setMatchCandidates(candidates),
            );
            return;
          }
        }
        // From the confirmation sheet the failure belongs inside it; from the
        // banner or the pin there is no Modal over the toast.
        if (matchModalOpen) setModalError({ modal: "match", message: getErrorMessage(err) });
        else showToast({ title: "Couldn't accept", message: getErrorMessage(err), variant: "error" });
      }
    });
    // matchActions is rebuilt each render by design (it closes over the current
    // busy state), so it is deliberately not a dependency.

  }, [conversationId, acceptMatch, refetchActiveDeal, conversation?.matched_by, user?.id,
      matchableDeal?.parcel_id, matchableDeal?.trip_id, afterChildModal, matchModalOpen, setModalError,
      conversation?.context_type]);

  /** Retry the match naming the delivery the user picked. */
  const handlePickDeal = useCallback(async (candidate: MatchCandidate) => {
    if (!conversationId) return;
    setModalError(null);
    try {
      await acceptMatch(conversationId, {
        parcel_id: candidate.parcel_id,
        trip_id: candidate.trip_id,
      });
      await refetchActiveDeal();
      setMatchCandidates(null);
      // Picking the delivery is the same press as Accept, so the same phase-aware words.
      showToast({
        ...matchResultToast(!!conversation?.matched_by && conversation.matched_by !== user?.id, conversation?.context_type === "buddy"),
        variant: "success",
        duration: 1800,
      });
    } catch (err) {
      setModalError({ modal: "dealPicker", message: getErrorMessage(err) });
    }
  }, [conversationId, acceptMatch, refetchActiveDeal, setModalError, conversation?.matched_by,
      conversation?.context_type, user?.id]);

  const handleDeclineConfirm = useCallback(
    async (reason: string) => {
      if (!conversationId) return;
      setModalError(null);
      await matchActions.run("decline", async () => {
        try {
          await declineMatch(conversationId, reason || undefined);
          // Same contract as accept: the pin must have the next state before
          // the dialog closes and the button comes back to life.
          await refetchActiveDeal();
          setDeclineOpen(false);
          showToast({ title: "Match declined", variant: "info", duration: 1800 });
        } catch (err) {
          setModalError({ modal: "decline", message: getErrorMessage(err) });
        }
      });
    },

    [conversationId, declineMatch, refetchActiveDeal, setModalError],
  );

  return {
    matchCandidates,
    setMatchCandidates,
    declineOpen,
    setDeclineOpen,
    matchModalOpen,
    setMatchModalOpen,
    matchPending,
    decliningPending,
    matchBusy,
    // The match acts on a parcel deal - decides the confirm sheet's copy, not the
    // thread's `context_type` label (one shared pair thread can say "buddy").
    hasParcelDeal: !!matchableDeal,
    handleAccept,
    handlePickDeal,
    handleDeclineConfirm,
  };
}

export type ChatMatchActionsController = ReturnType<typeof useChatMatchActions>;
