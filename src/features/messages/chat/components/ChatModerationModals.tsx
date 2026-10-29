import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { MediaGalleryModal } from "@/components/chat/MediaGalleryModal";
import { ReportMessageModal } from "@/components/chat/ReportMessageModal";

import { type ChatModal } from "../chatTypes";
import {
  BLOCK_CONFIRM_BODY,
  firstName,
  REPORT_SUBTITLE,
  UNBLOCK_CONFIRM_BODY,
  UNMATCH_CONFIRM_BODY,
} from "../lib/chatModerationRules";
import { type ChatActionMenuController } from "../hooks/useChatActionMenu";
import { type ChatBubbleMenuController } from "../hooks/useChatBubbleMenu";

interface ChatModerationModalsProps {
  actionMenu: ChatActionMenuController;
  bubbleActions: ChatBubbleMenuController;
  conversationId: string;
  participantName: string;
  errorFor: (modal: ChatModal) => string | null;
}

/**
 * The dialogs opened from the bubble menu and the conversation-actions sheet:
 * report a message, report the user, the shared media gallery, and the
 * block / unmatch confirmation.
 */
export function ChatModerationModals({
  actionMenu,
  bubbleActions,
  conversationId,
  participantName,
  errorFor,
}: Readonly<ChatModerationModalsProps>) {
  const {
    reportUserOpen,
    setReportUserOpen,
    reportUserPending,
    handleSubmitUserReport,
    mediaOpen,
    setMediaOpen,
    confirmAction,
    setConfirmAction,
    confirmPending,
    handleConfirmAction,
  } = actionMenu;
  const { reportTarget, setReportTarget, reportPending, handleSubmitReport } = bubbleActions;

  return (
    <>
      {/* ───────── Report message modal (per-message, long-press) ───────── */}
      <ReportMessageModal
        open={!!reportTarget}
        pending={reportPending}
        error={errorFor("reportMessage")}
        onCancel={() => {
          if (!reportPending) setReportTarget(null);
        }}
        onSubmit={(input) => void handleSubmitReport(input)}
      />

      {/* ───────── Report user modal (conversation-level, from actions) ───────── */}
      <ReportMessageModal
        open={reportUserOpen}
        pending={reportUserPending}
        error={errorFor("reportUser")}
        title={`Report ${firstName(participantName)}`}
        subtitle={REPORT_SUBTITLE}
        onCancel={() => {
          if (!reportUserPending) setReportUserOpen(false);
        }}
        onSubmit={(input) => void handleSubmitUserReport(input)}
      />

      {/* ───────── Shared media gallery ───────── */}
      <MediaGalleryModal
        open={mediaOpen}
        conversationId={conversationId}
        onClose={() => setMediaOpen(false)}
      />

      {/* ───────── Block / Unblock / Unmatch confirmation ─────────
          The chat block IS the app-wide block, so it uses the profile menu's words. */}
      <ConfirmActionModal
        open={!!confirmAction}
        title={
          confirmAction === "block"
            ? `Block ${participantName}?`
            : confirmAction === "unblock"
              ? `Unblock ${participantName}?`
              : "Unmatch?"
        }
        body={
          confirmAction === "block"
            ? BLOCK_CONFIRM_BODY
            : confirmAction === "unblock"
              ? UNBLOCK_CONFIRM_BODY
              : UNMATCH_CONFIRM_BODY
        }
        confirmLabel={confirmAction === "block" ? "Block" : confirmAction === "unblock" ? "Unblock" : "Unmatch"}
        icon={confirmAction === "block" ? "ban" : confirmAction === "unblock" ? "checkmark-circle" : "link"}
        tone={confirmAction === "unblock" ? "primary" : "destructive"}
        pending={confirmPending}
        error={errorFor("confirm")}
        onCancel={() => {
          if (!confirmPending) setConfirmAction(null);
        }}
        onConfirm={() => void handleConfirmAction()}
      />
    </>
  );
}
