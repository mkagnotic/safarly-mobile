import { Ionicons } from "@expo/vector-icons";
import { PropsWithChildren, useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Easing,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppPressable } from "@/components/ui/AppPressable";
import { registerAppFeedback } from "@/feedback/appFeedback";
import type { AppAlertOptions, ToastPayload, ToastVariant } from "@/feedback/types";
import { colors } from "@/theme/colors";
import { shadowCard, shadowSoft } from "@/theme/elevation";

const DEFAULT_TOAST_MS = 3400;

function toastAccent(variant: ToastVariant): { icon: keyof typeof Ionicons.glyphMap; fg: string; bg: string } {
  switch (variant) {
    case "success":
      return { icon: "checkmark-circle", fg: colors.safe, bg: "rgba(34, 195, 93, 0.12)" };
    case "error":
      return { icon: "close-circle", fg: colors.danger, bg: "rgba(220, 40, 40, 0.1)" };
    case "warning":
      return { icon: "warning", fg: colors.warning, bg: "rgba(245, 159, 10, 0.12)" };
    case "info":
    default:
      return { icon: "information-circle-outline", fg: colors.primary, bg: colors.surfaceTintPrimary };
  }
}

function ToastBanner({
  payload,
  onDismiss,
  topOffset,
  maxWidth,
}: Readonly<{
  payload: ToastPayload;
  onDismiss: () => void;
  topOffset: number;
  maxWidth: number;
}>) {
  const variant = payload.variant ?? "info";
  const accent = toastAccent(variant);
  const widthStyle = Math.min(maxWidth - 32, 420);
  const opacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(-14)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(opacity, {
        toValue: 1,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start();
  }, [opacity, translateY]);

  return (
    <Animated.View
      style={[
        styles.toastWrap,
        { top: topOffset, maxWidth: widthStyle },
        { opacity, transform: [{ translateY }] },
      ]}
    >
      <Pressable
        onPress={onDismiss}
        style={({ pressed }) => [
          styles.toastCard,
          shadowCard(),
          {
            borderLeftWidth: 4,
            borderLeftColor: accent.fg,
            opacity: pressed ? 0.94 : 1,
          },
        ]}
        accessibilityRole="alert"
        accessibilityLabel={[payload.title, payload.message].filter(Boolean).join(". ")}
      >
        <View style={[styles.toastIconCircle, { backgroundColor: accent.bg }]}>
          <Ionicons name={accent.icon} size={22} color={accent.fg} />
        </View>
        <View style={styles.toastTextCol}>
          <Text style={styles.toastTitle}>{payload.title}</Text>
          {payload.message ? <Text style={styles.toastMessage}>{payload.message}</Text> : null}
        </View>
      </Pressable>
    </Animated.View>
  );
}

function AppAlertModal({
  visible,
  options,
  onRequestClose,
}: Readonly<{
  visible: boolean;
  options: AppAlertOptions | null;
  onRequestClose: () => void;
}>) {
  const { width } = useWindowDimensions();
  const cardW = Math.min(width - 40, 400);
  const actions =
    options?.actions && options.actions.length > 0
      ? options.actions
      : [{ text: "OK", style: "default" as const, onPress: onRequestClose }];

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onRequestClose} statusBarTranslucent>
      <Pressable style={styles.alertBackdrop} onPress={onRequestClose} accessibilityRole="button" accessibilityLabel="Dismiss">
        <Pressable onPress={(e) => e.stopPropagation()} style={[styles.alertCard, shadowCard(), { width: cardW }]}>
          {/* Explicit dismiss. Tapping the backdrop already closes the sheet,
              but that affordance is invisible — a confirm dialog needs a way
              out that you can see, especially for destructive actions. */}
          <View style={styles.alertHeaderRow}>
            <Text style={[styles.alertTitle, styles.alertTitleFlex]}>{options?.title ?? ""}</Text>
            <AppPressable
              onPress={onRequestClose}
              hitSlop={10}
              style={styles.alertCloseButton}
              accessibilityRole="button"
              accessibilityLabel="Close"
            >
              <Ionicons name="close" size={18} color={colors.mutedText} />
            </AppPressable>
          </View>
          {options?.message ? <Text style={styles.alertMessage}>{options.message}</Text> : null}
          <View style={styles.alertActions}>
            {actions.map((action, index) => {
              const isCancel = action.style === "cancel";
              const isDestructive = action.style === "destructive";
              return (
                <AppPressable
                  key={`${action.text}-${index}`}
                  style={({ pressed }) => [
                    styles.alertBtn,
                    isCancel && styles.alertBtnGhost,
                    isDestructive && styles.alertBtnDanger,
                    !isCancel && !isDestructive && styles.alertBtnPrimary,
                    pressed && styles.alertBtnPressed,
                  ]}
                  onPress={() => {
                    action.onPress?.();
                    onRequestClose();
                  }}
                  accessibilityRole="button"
                >
                  <Text
                    style={[
                      styles.alertBtnText,
                      isCancel && styles.alertBtnTextMuted,
                      isDestructive && styles.alertBtnTextDanger,
                      !isCancel && !isDestructive && styles.alertBtnTextOnPrimary,
                    ]}
                  >
                    {action.text}
                  </Text>
                </AppPressable>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function AppFeedbackProvider({ children }: Readonly<PropsWithChildren>) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [alertOptions, setAlertOptions] = useState<AppAlertOptions | null>(null);

  const clearToastTimer = useCallback(() => {
    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
      toastTimer.current = null;
    }
  }, []);

  const dismissToast = useCallback(() => {
    clearToastTimer();
    setToast(null);
  }, [clearToastTimer]);

  const showToast = useCallback(
    (payload: ToastPayload) => {
      clearToastTimer();
      setToast({ variant: "info", ...payload });
      const ms = payload.duration ?? DEFAULT_TOAST_MS;
      toastTimer.current = setTimeout(() => {
        setToast(null);
        toastTimer.current = null;
      }, ms);
    },
    [clearToastTimer]
  );

  const showAlert = useCallback((options: AppAlertOptions) => {
    setAlertOptions(options);
  }, []);

  const dismissAlert = useCallback(() => {
    setAlertOptions(null);
  }, []);

  useEffect(() => {
    registerAppFeedback({ showToast, showAlert });
    return () => {
      registerAppFeedback(null);
      clearToastTimer();
    };
  }, [showToast, showAlert, clearToastTimer]);

  const topToast = Math.max(insets.top + 10, 16);

  return (
    <>
      {children}
      {toast ? (
        <View style={styles.toastLayer} pointerEvents="box-none">
          <ToastBanner payload={toast} onDismiss={dismissToast} topOffset={topToast} maxWidth={width} />
        </View>
      ) : null}
      <AppAlertModal visible={alertOptions != null} options={alertOptions} onRequestClose={dismissAlert} />
    </>
  );
}

const styles = StyleSheet.create({
  toastLayer: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 9999,
    elevation: 9999,
    pointerEvents: "box-none",
  },
  toastWrap: {
    position: "absolute",
    alignSelf: "center",
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  toastCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    backgroundColor: colors.card,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    gap: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...Platform.select<ViewStyle>({
      web: {
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      } as ViewStyle,
      default: {},
    }),
  },
  toastIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  toastTextCol: { flex: 1, gap: 4 },
  toastTitle: {
    color: colors.text,
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.2,
  },
  toastMessage: {
    color: colors.mutedText,
    fontSize: 14,
    lineHeight: 20,
    fontWeight: "500",
  },
  alertBackdrop: {
    flex: 1,
    backgroundColor: "rgba(32, 25, 46, 0.52)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  alertCard: {
    backgroundColor: colors.card,
    borderRadius: 20,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    ...shadowSoft(),
  },
  alertHeaderRow: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  alertTitle: {
    color: colors.text,
    fontSize: 18,
    fontWeight: "800",
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  alertTitleFlex: { flex: 1, minWidth: 0 },
  alertCloseButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.surfaceMuted,
  },
  alertMessage: {
    color: colors.mutedText,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 18,
    fontWeight: "500",
  },
  alertActions: { gap: 10 },
  alertBtn: {
    borderRadius: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  alertBtnPrimary: {
    backgroundColor: colors.primary,
  },
  alertBtnGhost: {
    backgroundColor: colors.surfaceMuted,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  alertBtnDanger: {
    backgroundColor: "rgba(220, 40, 40, 0.1)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(220, 40, 40, 0.35)",
  },
  alertBtnPressed: { opacity: 0.88 },
  alertBtnText: { fontSize: 16, fontWeight: "700" },
  alertBtnTextOnPrimary: { color: colors.white },
  alertBtnTextMuted: { color: colors.mutedText },
  alertBtnTextDanger: { color: colors.danger },
});
