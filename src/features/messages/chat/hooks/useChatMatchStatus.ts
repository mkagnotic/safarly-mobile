import { useMemo } from "react";

import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";
import { type Conversation } from "@/services/api";

import { getRoleForConversation } from "../chatHelpers";
import { type ChatUser } from "../chatTypes";

interface UseChatMatchStatusInput {
  conversation: Conversation | null;
  conversationId: string | null;
  activeDeal: UseActiveDealResult["activeDeal"];
  workflow: UseActiveDealResult["workflow"];
  user: ChatUser;
}

/**
 * The match state the screen shows: the header badge, the match banner, which
 * deal a match action is about, and whether the composer may send.
 */
export function useChatMatchStatus({
  conversation,
  conversationId,
  activeDeal,
  workflow,
  user,
}: UseChatMatchStatusInput) {
  // The header badge and the match banner must describe the DELIVERY ON SCREEN, not
  // the thread. With two deliveries in one chat the thread-level flag is "any of them
  // is matched", which showed a green "Matched" badge beside the person's name while
  // the pin below correctly offered "Match again" for the deal actually being viewed.
  // Blocking stays thread-level: you block a person, not a delivery.
  const conversationMatchStatus = conversation?.match_status ?? "pending";
  // A CONCLUDED deal keeps `match_status: matched` on purpose - that is what lets the
  // FSM resolve it to CANCELLED/COMPLETED and show the outcome instead of silently
  // hiding it. The BADGE must not repeat it, though: a deal whose request was rejected
  // (the sender handed the parcel to another carrier) or withdrawn is over, and a green
  // "Matched" chip beside the person's name says the opposite.
  // A deal is concluded when its REQUEST was retired, or when the workflow itself has
  // reached an outcome. Delivered is the one that bit: a completed delivery keeps its
  // request `accepted`, and an accepted request is unconditionally "matched" (a paid
  // delivery must never read as unmatched), so the header went on showing a green
  // "Matched" chip long after the parcel had been handed over and the match closed.
  const dealConcluded =
    activeDeal?.request_status === "rejected" ||
    activeDeal?.request_status === "withdrawn" ||
    ["COMPLETED", "ARCHIVED", "CANCELLED"].includes(workflow?.state ?? "");
  const matchStatus =
    conversationMatchStatus === "blocked"
      ? "blocked"
      : dealConcluded
        ? "pending"
        : activeDeal?.match_status ?? conversationMatchStatus;
  const matchRequester = activeDeal ? activeDeal.matched_by : conversation?.matched_by ?? null;

  // Only name the deal on screen when the MATCH ACTION IS ABOUT THAT DEAL.
  //
  // Two ways it goes wrong otherwise. A finished delivery stays on screen so its
  // outcome is visible, and "Match again" there means start a NEW one. Worse, a thread
  // can be showing a live delivery on a COMPLETELY DIFFERENT route: naming that one
  // re-ran the handshake on it instead of matching the route the user had just picked,
  // and if that other delivery ran the other way round the two of them saw the roles
  // reversed. A deal is only the subject of a match while it is still AT the match
  // step. Keep in sync with web CustomerMessages.tsx.
  const MATCH_STEP_STATES = ["NEGOTIATING", "MATCH_REQUESTED", "MATCH_DECLINED"];
  const matchableDeal =
    activeDeal &&
    activeDeal.request_status !== "rejected" &&
    activeDeal.request_status !== "withdrawn" &&
    MATCH_STEP_STATES.includes(workflow?.state ?? "")
      ? activeDeal
      : null;
  const isBlocked = matchStatus === "blocked";
  const matchedByOther =
    matchStatus === "pending" && !!matchRequester && matchRequester !== user?.id;
  const matchedByMe =
    matchStatus === "pending" && !!matchRequester && matchRequester === user?.id;
  // `matched_at` persists across unmatch, so its presence while pending (with no
  // current `matched_by`) marks a dissolved match vs a never-matched thread.
  const wasUnmatched =
    matchStatus === "pending" &&
    !matchRequester &&
    !!conversation?.matched_at;
  const isDeclined = matchStatus === "declined";
  const canSend = !isBlocked && !!conversationId;

  const userRole = useMemo(
    () => getRoleForConversation(conversation, user?.id ?? null),
    [conversation, user?.id],
  );

  const isMatched = matchStatus === "matched";

  // The match banner and the live-offer bar already own some states, so the pin
  // defers to them to avoid two controls doing the same job. But it defers only
  // when that bespoke UI is ACTUALLY on screen: a conversation just opened from
  // search isn't in the conversations list yet, so `conversation` is null, every
  // match-banner branch is false, and the banner renders nothing — which is why
  // the match prompt went missing. In that case the pin (driven directly by the
  // server FSM per conversation id) shows `request_match`, matching web.
  const matchBannerVisible =
    matchedByOther || matchedByMe || isDeclined || wasUnmatched || isBlocked;

  return {
    matchStatus,
    matchableDeal,
    isBlocked,
    matchedByOther,
    matchedByMe,
    wasUnmatched,
    isDeclined,
    canSend,
    userRole,
    isMatched,
    matchBannerVisible,
  };
}
