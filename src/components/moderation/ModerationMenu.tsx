import { useCallback, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { Modal, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ConfirmActionModal } from "@/components/chat/ConfirmActionModal";
import { ReportMessageModal } from "@/components/chat/ReportMessageModal";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { showToast } from "@/feedback/appFeedback";
import { useBlockedUsers } from "@/hooks/api/useBlockedUsers";
import { useModalHandoff } from "@/hooks/useModalHandoff";
import {
  getErrorMessage,
  moderationApi,
  type ReportReason,
  type ReportTarget,
} from "@/services/api";
import {
  BLOCK_CONFIRM_BODY,
  isReportRateLimit,
  REPORT_SUBTITLE,
  reportResultToast,
  UNBLOCK_CONFIRM_BODY,
} from "@/features/messages/chat/lib/chatModerationRules";
import { colors } from "@/theme/colors";

interface ModerationMenuProps {
  /** What "Report" files against. */
  target: ReportTarget;
  /** Menu row + accessibility label, e.g. "Report trip". */
  reportLabel: string;
  /** Report sheet title. Defaults to `reportLabel`. */
  reportTitle?: string;
  /**
   * Offer Block / Unblock for this person too. Without it the header button is
   * a single flag that opens the report sheet directly.
   */
  blockUser?: { id: string; name: string };
  /** Runs after a successful block — e.g. leave the blocked person's profile. */
  onBlocked?: () => void;
  /** Called after an unblock the server accepted. */
  onUnblocked?: () => void;
}

/**
 * Header entry point for reporting user-generated content and blocking its
 * author (App Store guideline 1.2). Render it only for OTHER people's content —
 * callers hide it on the viewer's own profile and listings.
 *
 * Every hop from the action sheet to the report or confirm sheet goes through
 * `useModalHandoff`: iOS silently refuses to present a Modal while another one
 * is still fading out.
 */
export function ModerationMenu({
  target,
  reportLabel,
  reportTitle,
  blockUser,
  onBlocked,
  onUnblocked,
}: Readonly<ModerationMenuProps>) {
  const insets = useSafeAreaInsets();
  const { isBlockedByMe, block, unblock } = useBlockedUsers();
  const { after: afterMenu, onDismiss: onMenuDismissed } = useModalHandoff();

  const [menuOpen, setMenuOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportPending, setReportPending] = useState(false);
  const [confirm, setConfirm] = useState<"block" | "unblock" | null>(null);
  const [confirmPending, setConfirmPending] = useState(false);
  // Failures render inside the open sheet: `showToast` draws in the root view,
  // under any Modal, so a failed report or block used to look like nothing
  // happened. Cleared on retry and when the sheet closes.
  const [reportError, setReportError] = useState<string | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const blocked = blockUser ? isBlockedByMe(blockUser.id) : false;

  const handleSubmitReport = useCallback(
    async ({ reason, details }: { reason: string; details: string | undefined }) => {
      setReportPending(true);
      setReportError(null);
      try {
        const res = await moderationApi.report({
          target_type: target.type,
          target_id: target.id,
          reason: reason as ReportReason,
          details,
        });
        setReportOpen(false);
        showToast(reportResultToast(res.data?.duplicate));
      } catch (err) {
        // Reports are rate-limited (5 an hour): the server's own sentence is shown
        // as sent, and the sheet stays open with the typed text.
        setReportError(
          isReportRateLimit(err) ? err.message.trim() : `Couldn't send report. ${getErrorMessage(err)}`,
        );
      } finally {
        setReportPending(false);
      }
    },
    [target.type, target.id],
  );

  const handleConfirm = useCallback(async () => {
    if (!blockUser || !confirm) return;
    setConfirmPending(true);
    setConfirmError(null);
    try {
      if (confirm === "block") {
        await block(blockUser.id);
        setConfirm(null);
        showToast({ title: `${blockUser.name} blocked`, variant: "info" });
        onBlocked?.();
      } else {
        await unblock(blockUser.id);
        setConfirm(null);
        showToast({ title: `${blockUser.name} unblocked`, variant: "info" });
        onUnblocked?.();
      }
    } catch (err) {
      setConfirmError(
        `${confirm === "block" ? "Couldn't block" : "Couldn't unblock"}. ${getErrorMessage(err)}`,
      );
    } finally {
      setConfirmPending(false);
    }
  }, [blockUser, confirm, block, unblock, onBlocked, onUnblocked]);

  const closeMenu = useCallback(() => setMenuOpen(false), []);

  return (
    <>
      {blockUser ? (
        <Pressable
          onPress={() => setMenuOpen(true)}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel="More actions"
          hitSlop={6}
        >
          <Ionicons name="ellipsis-horizontal" size={18} color={colors.text} />
        </Pressable>
      ) : (
        <Pressable
          onPress={() => setReportOpen(true)}
          style={styles.headerButton}
          accessibilityRole="button"
          accessibilityLabel={reportLabel}
          hitSlop={6}
        >
          <Ionicons name="flag-outline" size={18} color={colors.text} />
        </Pressable>
      )}

      {blockUser ? (
        <Modal
          visible={menuOpen}
          transparent
          animationType="fade"
          onRequestClose={closeMenu}
          onDismiss={onMenuDismissed}
        >
          <Pressable
            style={styles.backdrop}
            onPress={closeMenu}
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
          />
          <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
            <MenuRow
              icon="flag-outline"
              label={reportLabel}
              onPress={() => afterMenu(closeMenu, () => setReportOpen(true))}
            />
            {blocked ? (
              <MenuRow
                icon="checkmark-circle-outline"
                label="Unblock user"
                onPress={() => afterMenu(closeMenu, () => setConfirm("unblock"))}
              />
            ) : (
              <MenuRow
                icon="ban"
                label="Block user"
                tone="danger"
                onPress={() => afterMenu(closeMenu, () => setConfirm("block"))}
              />
            )}
            <View style={styles.divider} />
            <MenuRow icon="close" label="Cancel" onPress={closeMenu} />
          </View>
        </Modal>
      ) : null}

      <ReportMessageModal
        open={reportOpen}
        pending={reportPending}
        title={reportTitle ?? reportLabel}
        subtitle={REPORT_SUBTITLE}
        error={reportError}
        onCancel={() => {
          if (reportPending) return;
          setReportError(null);
          setReportOpen(false);
        }}
        onSubmit={handleSubmitReport}
      />

      {blockUser ? (
        <ConfirmActionModal
          open={confirm !== null}
          title={confirm === "unblock" ? `Unblock ${blockUser.name}?` : `Block ${blockUser.name}?`}
          body={
            confirm === "unblock"
              ? UNBLOCK_CONFIRM_BODY
              : BLOCK_CONFIRM_BODY
          }
          confirmLabel={confirm === "unblock" ? "Unblock" : "Block"}
          tone={confirm === "unblock" ? "primary" : "destructive"}
          icon={confirm === "unblock" ? "checkmark-circle" : "ban"}
          pending={confirmPending}
          error={confirmError}
          onCancel={() => {
            if (confirmPending) return;
            setConfirmError(null);
            setConfirm(null);
          }}
          onConfirm={handleConfirm}
        />
      ) : null}
    </>
  );
}

function MenuRow({
  icon,
  label,
  onPress,
  tone,
}: Readonly<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: "danger";
}>) {
  const color = tone === "danger" ? colors.danger : colors.text;
  return (
    <Pressable onPress={onPress} style={styles.row} accessibilityRole="button" accessibilityLabel={label}>
      <Ionicons name={icon} size={20} color={color} />
      <Text style={[styles.rowLabel, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  // Same 40pt round as the screens' back buttons, so the header stays balanced.
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  // Action sheet — same treatment as the chat's header kebab sheet.
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(15,15,25,0.4)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 10,
  },
  rowLabel: { fontSize: 15, fontWeight: "600" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginHorizontal: 14,
    marginVertical: 4,
  },
});
