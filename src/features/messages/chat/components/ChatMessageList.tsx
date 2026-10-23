import { useMemo, type RefObject } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  View,
  type ListRenderItem,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { type DisplayMessage, type UseChatMessagesResult } from "@/hooks/api/useChatMessages";
import { getErrorMessage } from "@/services/api";
import { colors } from "@/theme/colors";

import { chatStyles } from "../chatStyles";

interface ChatMessageListProps {
  flatListRef: RefObject<FlatList<DisplayMessage> | null>;
  messages: UseChatMessagesResult["messages"];
  loading: UseChatMessagesResult["loading"];
  loadingOlder: UseChatMessagesResult["loadingOlder"];
  error: UseChatMessagesResult["error"];
  refetch: UseChatMessagesResult["refetch"];
  keyExtractor: (item: DisplayMessage) => string;
  renderMessage: ListRenderItem<DisplayMessage>;
  /** Near the oldest loaded message: load the page before it. */
  handleReachOldest: () => void;
}

/** ───────── Messages list ───────── */
export function ChatMessageList({
  flatListRef,
  messages,
  loading,
  loadingOlder,
  error,
  refetch,
  keyExtractor,
  renderMessage,
  handleReachOldest,
}: Readonly<ChatMessageListProps>) {
  // ⚠️ INVERTED list, newest first: opening a chat lands on the newest message by
  // construction and stays there while rows, images and the bars around the
  // list settle. See useChatAutoScroll for the iPhone 8 report this fixes.
  const newestFirst = useMemo(() => [...messages].reverse(), [messages]);
  return (
    <View style={styles.flex}>
      {loading && messages.length === 0 ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.centeredBody}>Loading messages…</Text>
        </View>
      ) : error && messages.length === 0 ? (
        <View style={styles.centered}>
          <Ionicons name="cloud-offline-outline" size={36} color={colors.mutedText} />
          <Text style={styles.centeredTitle}>Couldn't load messages</Text>
          <Text style={styles.centeredBody}>{getErrorMessage(error)}</Text>
          <Pressable
            style={styles.retryButton}
            onPress={() => void refetch()}
            accessibilityRole="button"
          >
            <Text style={styles.retryButtonText}>Try again</Text>
          </Pressable>
        </View>
      ) : messages.length === 0 ? (
        // Outside the list: an inverted list would draw its empty state upside down.
        <View style={styles.centered}>
          <View style={styles.emptyIconBubble}>
            <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
          </View>
          <Text style={styles.centeredTitle}>Start the conversation</Text>
          <Text style={styles.centeredBody}>Send a message to break the ice.</Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          inverted
          data={newestFirst}
          keyExtractor={keyExtractor}
          renderItem={renderMessage}
          onEndReached={handleReachOldest}
          onEndReachedThreshold={0.3}
          contentContainerStyle={styles.listContent}
          // Inverted: the FOOTER is drawn at the top of the thread.
          ListFooterComponent={
            // WhatsApp-style: no persistent button — scrolling near the top
            // auto-loads older messages (handleReachOldest), and this
            // spinner shows only while that fetch is in flight.
            loadingOlder ? (
              <View style={styles.loadOlderSpinner}>
                <ActivityIndicator size="small" color={colors.mutedText} />
              </View>
            ) : null
          }
        />
      )}
    </View>
  );
}

const listStyles = StyleSheet.create({
  // List
  // gap 2 (not 8): rows carry their own margins, so consecutive bubbles sit ~6px
  // apart and system asides ~14px — the tighter grouping messaging apps use.
  // Inverted list: paddingTop is drawn at the BOTTOM (above the composer).
  listContent: { paddingHorizontal: 14, paddingTop: 16, paddingBottom: 12, gap: 2 },

  // Top "loading older messages" spinner (WhatsApp-style, auto-load on scroll-up)
  loadOlderSpinner: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
  },

  emptyIconBubble: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceTintPrimary,
    marginBottom: 4,
  },
  retryButton: {
    marginTop: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: colors.ctaAccent,
  },
  retryButtonText: { color: colors.white, fontSize: 13, fontWeight: "700" },
});

const styles = { ...chatStyles, ...listStyles };
