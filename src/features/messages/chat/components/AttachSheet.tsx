import { Modal, Text, View, type StyleProp, type ViewStyle } from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";

import { chatStyles as styles } from "../chatStyles";
import { type ChatComposerController } from "../hooks/useChatComposer";
import { ActionRow } from "./ActionRow";

interface AttachSheetProps {
  composer: ChatComposerController;
  sheetInset: StyleProp<ViewStyle>;
}

/** ───────── Attach sheet (composer paperclip) ───────── */
export function AttachSheet({ composer, sheetInset }: Readonly<AttachSheetProps>) {
  const {
    attachMenuOpen,
    setAttachMenuOpen,
    onAttachMenuDismissed,
    afterAttachMenu,
    handlePickImage,
    handleTakePhoto,
    handlePickDocument,
  } = composer;

  return (
    <Modal
      visible={attachMenuOpen}
      transparent
      animationType="fade"
      onRequestClose={() => setAttachMenuOpen(false)}
      onDismiss={onAttachMenuDismissed}
    >
      <Pressable style={styles.modalBackdrop} onPress={() => setAttachMenuOpen(false)} />
      <View style={[styles.actionSheet, sheetInset]}>
        <Text style={styles.actionSheetTitle}>Attach</Text>
        <ActionRow
          icon="image"
          label="Send a photo"
          onPress={() => afterAttachMenu(() => setAttachMenuOpen(false), () => void handlePickImage())}
        />
        <ActionRow
          icon="camera-outline"
          label="Take a photo"
          onPress={() => afterAttachMenu(() => setAttachMenuOpen(false), () => void handleTakePhoto())}
        />
        <ActionRow
          icon="document-attach"
          label="Send a document or video"
          onPress={() => afterAttachMenu(() => setAttachMenuOpen(false), () => void handlePickDocument())}
        />
        <View style={styles.actionDivider} />
        <ActionRow icon="close" label="Cancel" onPress={() => setAttachMenuOpen(false)} />
      </View>
    </Modal>
  );
}
