import { useCallback, useState } from "react";

import { showAppAlert, showToast } from "@/feedback/appFeedback";
import { type UseActiveDealResult } from "@/hooks/api/useActiveDeal";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { type UseMyConversationsResult } from "@/hooks/api/useMyConversations";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { bumpRealtimeTopic } from "@/store/realtimeBus";
import { ApiClientError, getErrorMessage, messagesApi, type Conversation } from "@/services/api";

import { type ChatNav, type SetChatModalError } from "../chatTypes";
import { reportErrorText, reportResultToast } from "../lib/chatModerationRules";

interface UseChatActionMenuInput {
  conversationId: string | null;
  conversation: Conversation | null;
  /** Shown in the block / unblock toasts ("{name} blocked"). */
  participantName: string;
  activeDeal: UseActiveDealResult["activeDeal"];
  matchableDeal: UseActiveDealResult["activeDeal"];
  navigation: ChatNav;
  refetchConversations: UseMyConversationsResult["refetch"];
  refetchActiveDeal: UseActiveDealResult["refetch"];
  afterChildModal: ReturnType<typeof useModalHandoff>["after"];
  setModalError: SetChatModalError;
}

/**
 * The header kebab's conversation-actions sheet and everything it opens: shared
 * media, archive, report user, raise dispute, block / unblock and unmatch.
 */
export function useChatActionMenu({
  conversationId,
  conversation,
  participantName,
  activeDeal,
  matchableDeal,
  navigation,
  refetchConversations,
  refetchActiveDeal,
  afterChildModal,
  setModalError,
}: UseChatActionMenuInput) {
  // The header kebab opens the conversation-actions sheet; the composer
  // paperclip opens the attach sheet (see `useChatComposer`).
  const [actionMenuOpen, setActionMenuOpen] = useState(false);
  // iOS can't present a Modal while another is still fading out, so anything
  // opened from the sheet waits for it to dismiss.
  const { after: afterActionMenu, onDismiss: onActionMenuDismissed } = useModalHandoff();
  const [mediaOpen, setMediaOpen] = useState(false);
  const [reportUserOpen, setReportUserOpen] = useState(false);
  const [reportUserPending, setReportUserPending] = useState(false);
  const [archivePending, setArchivePending] = useState(false);
  const [unblockPending, setUnblockPending] = useState(false);
  // The confirm states reuse one ConfirmActionModal — `null` when closed,
  // "block", "unblock" or "unmatch" when open. Mirrors web's `confirmAction`
  // pattern in `ChatActionDropdown.tsx`. Unblock is confirmed too, as on web and
  // on the profile menu (flow-18 bug 7).
  const [confirmAction, setConfirmAction] = useState<"block" | "unblock" | "unmatch" | null>(null);
  // A chat block is the same app-wide block as the profile one: search and the
  // listings must hide (or show again) the person at once, not when the cached
  // list goes stale (flow-18 bug 6).
  const { refetch: refetchBlocks } = useBlockedUsers();
  const [confirmPending, setConfirmPending] = useState(false);

  // Both block and unmatch open the same shared ConfirmActionModal — the
  // `confirmAction` slot decides title/body/icon. Web does the same with one
  // Dialog + a "block" | "unblock" | "unmatch" enum (ChatActionDropdown.tsx).
  const handleUnmatch = useCallback(() => {
    if (!conversationId) return;
    afterActionMenu(() => setActionMenuOpen(false), () => setConfirmAction("unmatch"));
  }, [conversationId, afterActionMenu]);

  const handleBlock = useCallback(() => {
    if (!conversationId) return;
    afterActionMenu(() => setActionMenuOpen(false), () => setConfirmAction("block"));
  }, [conversationId, afterActionMenu]);

  const handleConfirmAction = useCallback(async () => {
    if (!conversationId || !confirmAction) return;
    setConfirmPending(true);
    setModalError(null);
    if (confirmAction === "unblock") setUnblockPending(true);
    try {
      if (confirmAction === "block") {
        await messagesApi.blockUser(conversationId);
        showToast({ title: `${participantName} blocked`, variant: "info" });
        void refetchBlocks();
      } else if (confirmAction === "unblock") {
        // The block really is gone, so say so. When the other person still blocks,
        // the server answers still_blocked and the refetch below keeps the chat
        // closed. No reason is given: the server deliberately announces nothing.
        await messagesApi.unblockUser(conversationId);
        showToast({ title: `${participantName} unblocked`, variant: "info" });
        void refetchBlocks();
      } else {
        // End the delivery on screen, not whichever one the server would have picked.
        // ⚠️ activeDeal, NOT matchableDeal: Unmatch is only offered once the deal is
        // MATCHED, which is past the match step, so matchableDeal is always null here.
        // Sending nothing made the server guess, and every finished delivery with this
        // person still reads "accepted" - "Choose which one to end" with nothing live
        // (client, 25 Oct 2026).
        await messagesApi.unmatchConversation(conversationId, {
          carrier_request_id: (activeDeal ?? matchableDeal)?.carrier_request_id ?? undefined,
        });
        showToast({ title: "Unmatched", variant: "info" });
      }
      setConfirmAction(null);
      // Flip the match-state banner AND the pinned workflow bar instantly
      // instead of waiting on realtime. Unmatch reverts the conversation to
      // `pending`, so the match prompt has to come back - awaited, so the
      // confirm button stays busy until the screen actually has that state
      // (fire-and-forget left the old banner up and looked like nothing
      // happened). The bump wakes the inbox and My Travels, whose listing
      // statuses the unmatch also reverts.
      for (const t of ["conversations", "messages", "carrier-requests", "parcels", "trips", "bookings"] as const) {
        bumpRealtimeTopic(t);
      }
      await Promise.all([refetchConversations(), refetchActiveDeal()]);
    } catch (err) {
      // Guard may reject if the state moved (e.g. already unmatched). Resync.
      void refetchConversations();

      // A blocked unmatch used to dead-end: "Cancel the booking first to end the
      // match" with no way to reach that booking. The server now names it, so
      // offer a route straight there - Cancel lives on the booking card.
      const blocker =
        err instanceof ApiClientError
          ? (err.details?.[0] as { booking_id?: string; action?: string } | undefined)
          : undefined;
      if (confirmAction === "unmatch" && blocker?.booking_id) {
        afterChildModal(() => setConfirmAction(null), () => showAppAlert({
          title: "Can't unmatch yet",
          message: getErrorMessage(err),
          actions: [
            { text: "Not now", style: "cancel" },
            {
              text: blocker.action === "view_dispute" ? "View dispute" : "Go to booking",
              onPress: () => {
                if (blocker.action === "view_dispute") navigation.navigate("DisputesTab");
                else navigation.navigate("BookingsTab", { expandId: blocker.booking_id as string });
              },
            },
          ],
        }));
        return;
      }

      setModalError({
        modal: "confirm",
        message: confirmAction === "unblock" ? `Couldn't unblock. ${getErrorMessage(err)}` : getErrorMessage(err),
      });
    } finally {
      setConfirmPending(false);
      setUnblockPending(false);
    }
  }, [conversationId, confirmAction, refetchConversations, refetchActiveDeal, navigation, afterChildModal,
      setModalError, activeDeal?.carrier_request_id, matchableDeal?.carrier_request_id, participantName,
      refetchBlocks]);

  // Unblock asks first (same words as the profile menu and web). The confirm
  // button stays on a spinner until the call answers and the chat has the new
  // state - it used to close at once and the chat sat blocked with no sign
  // anything was happening (27 Oct 2026).
  const handleUnblock = useCallback(() => {
    if (!conversationId || unblockPending) return;
    afterActionMenu(() => setActionMenuOpen(false), () => setConfirmAction("unblock"));
  }, [conversationId, unblockPending, afterActionMenu]);

  // ───────── Header action-menu handlers (web parity) ─────────
  const isArchived = conversation?.archived === true;

  const handleArchiveToggle = useCallback(async () => {
    if (!conversationId || archivePending) return;
    // Pending BEFORE the sheet closes, so "Working…" is actually seen.
    setArchivePending(true);
    try {
      if (isArchived) {
        await messagesApi.unarchiveConversation(conversationId);
        showToast({ title: "Chat unarchived", variant: "info", duration: 1600 });
      } else {
        await messagesApi.archiveConversation(conversationId);
        showToast({ title: "Chat archived", variant: "info", duration: 1600 });
      }
      setActionMenuOpen(false);
      void refetchConversations();
    } catch (err) {
      showToast({
        title: isArchived ? "Couldn't unarchive" : "Couldn't archive",
        message: getErrorMessage(err),
        variant: "error",
      });
    } finally {
      setArchivePending(false);
    }
  }, [conversationId, isArchived, refetchConversations, archivePending]);

  // Raise a dispute: jump to the filing screen pre-scoped to this deal's booking
  // when one exists, otherwise the disputes list where the user can pick one.
  const handleRaiseDispute = useCallback(() => {
    setActionMenuOpen(false);
    const bookingId = activeDeal?.booking_id ?? null;
    if (bookingId) navigation.navigate("FileDisputeTab", { bookingId });
    else navigation.navigate("DisputesTab");
  }, [activeDeal?.booking_id, navigation]);

  // Conversation-level report reuses the message-report endpoint with the
  // conversation id as the target — exactly what web's "Report User" does.
  const handleSubmitUserReport = useCallback(
    async ({ reason, details }: { reason: string; details: string | undefined }) => {
      if (!conversationId) return;
      setReportUserPending(true);
      setModalError(null);
      try {
        const res = await messagesApi.reportMessage(conversationId, reason, details);
        setReportUserOpen(false);
        // A repeat report is not a new one (flow-18 bug 1): same words as the profile menu.
        showToast(reportResultToast(res.data?.duplicate));
      } catch (err) {
        // The sheet stays open with the typed text; a rate limit shows the server's sentence.
        setModalError({ modal: "reportUser", message: reportErrorText(err, (e) => getErrorMessage(e)) });
      } finally {
        setReportUserPending(false);
      }
    },
    [conversationId, setModalError],
  );

  return {
    actionMenuOpen,
    setActionMenuOpen,
    afterActionMenu,
    onActionMenuDismissed,
    mediaOpen,
    setMediaOpen,
    reportUserOpen,
    setReportUserOpen,
    reportUserPending,
    archivePending,
    unblockPending,
    confirmAction,
    setConfirmAction,
    confirmPending,
    isArchived,
    handleUnmatch,
    handleBlock,
    handleConfirmAction,
    handleUnblock,
    handleArchiveToggle,
    handleRaiseDispute,
    handleSubmitUserReport,
  };
}

export type ChatActionMenuController = ReturnType<typeof useChatActionMenu>;
