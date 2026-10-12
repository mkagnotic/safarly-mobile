import { Modal, ScrollView, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { chatStyles as styles } from "../chatStyles";
import { type ChatActionMenuController } from "../hooks/useChatActionMenu";
import { ActionRow } from "./ActionRow";

interface ChatActionsSheetProps {
  actionMenu: ChatActionMenuController;
  sheetInset: StyleProp<ViewStyle>;
  matchStatus: string;
  matchedByOther: boolean;
  isBlocked: boolean;
  setMatchModalOpen: (open: boolean) => void;
  setDeclineOpen: (open: boolean) => void;
}

/**
 * ───────── Conversation actions sheet (header kebab) ─────────
 * Mirrors web's ChatActionDropdown: Match/Decline, View media, Archive,
 * Report user, Raise dispute, Block/Unblock, Unmatch.
 */
export function ChatActionsSheet({
  actionMenu,
  sheetInset,
  matchStatus,
  matchedByOther,
  isBlocked,
  setMatchModalOpen,
  setDeclineOpen,
}: Readonly<ChatActionsSheetProps>) {
  const {
    actionMenuOpen,
    setActionMenuOpen,
    onActionMenuDismissed,
    afterActionMenu,
    isArchived,
    archivePending,
    setMediaOpen,
    setReportUserOpen,
    handleArchiveToggle,
    handleRaiseDispute,
    handleUnblock,
    handleBlock,
    handleUnmatch,
  } = actionMenu;

  return (
    <Modal
      visible={actionMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setActionMenuOpen(false)}
      onDismiss={onActionMenuDismissed}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setActionMenuOpen(false)} />
      <View style={[styles.actionSheet, styles.actionSheetTall, sheetInset]}>
        <Text style={styles.actionSheetTitle}>Chat actions</Text>
        <ScrollView showsVerticalScrollIndicator={false}>
          {matchStatus === "pending" || matchStatus === "declined" ? (
            <ActionRow
              icon="checkmark-circle"
              label={matchStatus === "declined" ? "Match again" : "Send match request"}
              onPress={() => afterActionMenu(() => setActionMenuOpen(false), () => setMatchModalOpen(true))}
            />
          ) : null}
          {/* Decline answers a request, so it is offered only while the other
              person has one waiting. On a fresh thread there is nothing to decline
              and the server refuses. */}
          {matchedByOther ? (
            <ActionRow
              icon="close-circle"
              label="Decline match"
              tone="danger"
              onPress={() => afterActionMenu(() => setActionMenuOpen(false), () => setDeclineOpen(true))}
            />
          ) : null}
          {matchStatus === "pending" || matchStatus === "declined" ? (
            <View style={styles.actionDivider} />
          ) : null}

          <ActionRow
            icon="images-outline"
            label="View media"
            onPress={() => afterActionMenu(() => setActionMenuOpen(false), () => setMediaOpen(true))}
          />
          <ActionRow
            icon={isArchived ? "arrow-undo-outline" : "archive-outline"}
            label={
              archivePending
                ? "Working…"
                : isArchived
                  ? "Unarchive chat"
                  : "Archive chat"
            }
            onPress={handleArchiveToggle}
          />
          <ActionRow
            icon="flag-outline"
            label="Report user"
            onPress={() => afterActionMenu(() => setActionMenuOpen(false), () => setReportUserOpen(true))}
          />
          <ActionRow icon="scale-outline" label="Raise dispute" onPress={handleRaiseDispute} />

          {isBlocked ? (
            <ActionRow icon="checkmark-circle" label="Unblock user" onPress={handleUnblock} />
          ) : (
            <ActionRow icon="ban" label="Block user" tone="danger" onPress={handleBlock} />
          )}
          {matchStatus === "matched" ? (
            <ActionRow icon="link" label="Unmatch" tone="danger" onPress={handleUnmatch} />
          ) : null}

          <View style={styles.actionDivider} />
          <ActionRow icon="close" label="Cancel" onPress={() => setActionMenuOpen(false)} />
        </ScrollView>
      </View>
    </Modal>
  );
}
