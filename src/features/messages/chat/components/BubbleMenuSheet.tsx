import { Modal, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { chatStyles as styles } from "../chatStyles";
import { type ChatBubbleMenuController } from "../hooks/useChatBubbleMenu";
import { ActionRow } from "./ActionRow";

interface BubbleMenuSheetProps {
  bubbleActions: ChatBubbleMenuController;
  sheetInset: StyleProp<ViewStyle>;
}

/** ───────── Bubble long-press menu ───────── */
export function BubbleMenuSheet({ bubbleActions, sheetInset }: Readonly<BubbleMenuSheetProps>) {
  const { bubbleMenu, setBubbleMenu, onBubbleMenuDismissed, handleCopyText, handleOpenReport } =
    bubbleActions;

  return (
    <Modal
      visible={!!bubbleMenu}
      transparent
      animationType="fade"
      onRequestClose={() => setBubbleMenu(null)}
      onDismiss={onBubbleMenuDismissed}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setBubbleMenu(null)} />
      <View style={[styles.actionSheet, sheetInset]}>
        <Text style={styles.actionSheetTitle}>Message</Text>
        {bubbleMenu?.text && bubbleMenu.text !== "📎 Attachment" ? (
          <ActionRow
            icon="copy"
            label="Copy text"
            onPress={() => void handleCopyText()}
          />
        ) : null}
        <ActionRow
          icon="flag"
          label="Report message"
          tone="danger"
          onPress={handleOpenReport}
        />
        <View style={styles.actionDivider} />
        <ActionRow icon="close" label="Cancel" onPress={() => setBubbleMenu(null)} />
      </View>
    </Modal>
  );
}
