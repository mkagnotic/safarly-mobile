import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { MediaGalleryModal } from "@/components/chat/MediaGalleryModal";
import { ReportMessageModal } from "@/components/chat/ReportMessageModal";

import { type ChatModal } from "../chatTypes";
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
        title={`Report ${participantName.split(" ")[0]}`}
        subtitle="Help us keep Safarly safe. Our trust & safety team reviews every report."
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

      {/* ───────── Block / Unmatch confirmation ───────── */}
      <ConfirmActionModal
        open={!!confirmAction}
        title={
          confirmAction === "block" ? `Block ${participantName}?` : "Unmatch?"
        }
        body={
          confirmAction === "block"
            ? "They won't be able to message you. You can unblock from this menu later."
            : "This conversation will revert to pending. Either side can request a new match anytime."
        }
        confirmLabel={confirmAction === "block" ? "Block" : "Unmatch"}
        icon={confirmAction === "block" ? "ban" : "link"}
        tone="destructive"
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
