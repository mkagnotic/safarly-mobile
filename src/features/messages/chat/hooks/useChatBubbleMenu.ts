import { useCallback, useState } from "react";
import * as Clipboard from "expo-clipboard";

import { showToast } from "@/feedback/appFeedback";
import { type DisplayMessage } from "@/hooks/api/useChatMessages";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import { getErrorMessage, messagesApi } from "@/services/api";

import { type SetChatModalError } from "../chatTypes";
import { reportErrorText, reportResultToast } from "../lib/chatModerationRules";

// ───────── Bubble long-press: copy / report ─────────

/** The long-press menu on a message bubble, and reporting that message. */
export function useChatBubbleMenu({ setModalError }: { setModalError: SetChatModalError }) {
  // iOS can't present a Modal while another is still fading out, so the report
  // dialog opened from this menu waits for it to dismiss.
  const { after: afterBubbleMenu, onDismiss: onBubbleMenuDismissed } = useModalHandoff();
  const [reportTarget, setReportTarget] = useState<DisplayMessage | null>(null);
  const [reportPending, setReportPending] = useState(false);
  const [bubbleMenu, setBubbleMenu] = useState<DisplayMessage | null>(null);

  const handleBubbleLongPress = useCallback((message: DisplayMessage) => {
    setBubbleMenu(message);
  }, []);

  const handleCopyText = useCallback(async () => {
    const target = bubbleMenu;
    setBubbleMenu(null);
    if (!target?.text) return;
    try {
      await Clipboard.setStringAsync(target.text);
      showToast({ title: "Copied", variant: "info", duration: 1200 });
    } catch (err) {
      showToast({ title: "Couldn't copy", message: getErrorMessage(err), variant: "error" });
    }
  }, [bubbleMenu]);

  const handleOpenReport = useCallback(() => {
    const target = bubbleMenu;
    if (!target) {
      setBubbleMenu(null);
      return;
    }
    // Skip pending/local-only messages — they have no server id to report.
    if (target._clientStatus) {
      setBubbleMenu(null);
      showToast({
        title: "Can't report yet",
        message: "Wait until the message has been sent.",
        variant: "warning",
      });
      return;
    }
    afterBubbleMenu(() => setBubbleMenu(null), () => setReportTarget(target));
  }, [bubbleMenu, afterBubbleMenu]);

  const handleSubmitReport = useCallback(
    async ({ reason, details }: { reason: string; details: string | undefined }) => {
      const target = reportTarget;
      if (!target) return;
      setReportPending(true);
      setModalError(null);
      try {
        const res = await messagesApi.reportMessage(target.id, reason, details);
        setReportTarget(null);
        // The server dedupes per person: a repeat says so (flow-18 bug 1).
        showToast(reportResultToast(res.data?.duplicate));
      } catch (err) {
        // A rate limit shows the server's sentence; the sheet keeps the typed text.
        setModalError({ modal: "reportMessage", message: reportErrorText(err, (e) => getErrorMessage(e)) });
      } finally {
        setReportPending(false);
      }
    },
    [reportTarget, setModalError],
  );

  return {
    bubbleMenu,
    setBubbleMenu,
    onBubbleMenuDismissed,
    reportTarget,
    setReportTarget,
    reportPending,
    handleBubbleLongPress,
    handleCopyText,
    handleOpenReport,
    handleSubmitReport,
  };
}

export type ChatBubbleMenuController = ReturnType<typeof useChatBubbleMenu>;
