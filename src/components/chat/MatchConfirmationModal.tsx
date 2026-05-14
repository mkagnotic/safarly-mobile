import { useEffect, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { colors } from "@/theme/colors";

export type MatchUserRole = "carrier" | "sender";

interface MatchConfirmationModalProps {
  open: boolean;
  pending: boolean;
  userRole: MatchUserRole;
  /** Conversation `context_type` — `"buddy"` switches the copy to the buddy variant. */
  contextType?: string;
  onCancel: () => void;
  onConfirm: () => void;
}

/** Web parity (`MatchConfirmationModal.tsx:34-41`). */
const RESTRICTED_ITEMS: readonly string[] = [
  "Weapons, firearms, or explosives",
  "Drugs or controlled substances",
  "Flammable, toxic, or hazardous materials",
  "Perishable or leaking items",
  "Large quantities of liquids",
  "High-value undeclared items",
];

const CARRIER_RESPONSIBILITIES: readonly string[] = [
  "You may inspect the parcel before accepting it.",
  "You can decline if contents are unclear, unsafe, or contain restricted items.",
  "You can decline if packaging is improper or insufficient.",
];

const SENDER_RESPONSIBILITIES: readonly string[] = [
  "You must provide accurate parcel details and descriptions.",
  "No restricted or illegal items may be included.",
  "You are responsible for any misrepresentation of parcel contents.",
];

const BUDDY_SAFETY: readonly string[] = [
  "Always meet in safe, public places.",
  "Share only minimal personal information.",
  "Coordinate through the in-app chat only.",
  "Never make advance payments or share sensitive financial data.",
];

/**
 * Mirrors web's `MatchConfirmationModal` (`customer/components/MatchConfirmationModal.tsx`).
 * Shows role-aware obligations + restricted-items list; the Confirm button only
 * enables once the user checks the agreement box.
 */
export function MatchConfirmationModal({
  open,
  pending,
  userRole,
  contextType = "booking",
  onCancel,
  onConfirm,
}: Readonly<MatchConfirmationModalProps>) {
  const [agreed, setAgreed] = useState(false);
  const isBuddy = contextType === "buddy";
  const responsibilities =
    userRole === "carrier" ? CARRIER_RESPONSIBILITIES : SENDER_RESPONSIBILITIES;

  // Reset agreement when the modal closes so the next open requires re-confirmation.
  useEffect(() => {
    if (!open) setAgreed(false);
  }, [open]);

  const subjectNoun = isBuddy ? "travel buddy" : "parcel";
  const subjectArrangement = isBuddy ? "travel arrangement" : "parcel";

  return (
    <Modal
      visible={open}
      transparent
      animationType="fade"
      onRequestClose={() => {
        if (!pending) onCancel();
      }}
    >
      <Pressable
        style={styles.backdrop}
        onPress={() => {
          if (!pending) onCancel();
        }}
        accessibilityRole="button"
        accessibilityLabel="Dismiss"
      />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} />
          </View>
          <View style={styles.headerText}>
            <Text style={styles.title}>Confirm Match</Text>
            <Text style={styles.subtitle}>
              Please review and agree to the following before confirming.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              if (!pending) onCancel();
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel="Close"
          >
            <Ionicons name="close" size={20} color={colors.mutedText} />
          </Pressable>
        </View>

        <ScrollView
          style={styles.body}
          contentContainerStyle={styles.bodyContent}
          showsVerticalScrollIndicator={false}
        >
          <Section icon="shield-outline" title="General Disclaimer">
            <BulletItem>You have reviewed the {subjectNoun} details.</BulletItem>
            <BulletItem>
              Safarly acts only as a connector — the platform bears no
              responsibility for the {subjectArrangement}.
            </BulletItem>
            <BulletItem>
              You must comply with airline, customs, and local regulations.
            </BulletItem>
          </Section>

          <View style={styles.divider} />

          <Section
            icon={userRole === "carrier" ? "car" : "cube-outline"}
            title={
              userRole === "carrier"
                ? "Carrier Responsibilities"
                : "Sender Responsibilities"
            }
          >
            {responsibilities.map((line) => (
              <BulletItem key={line}>{line}</BulletItem>
            ))}
          </Section>

          <View style={styles.divider} />

          <Section icon="warning" title="Restricted Items" tone="danger">
            {RESTRICTED_ITEMS.map((item) => (
              <BulletItem key={item} tone="danger">
                {item}
              </BulletItem>
            ))}
          </Section>

          {isBuddy ? (
            <>
              <View style={styles.divider} />
              <Section icon="people-outline" title="Travel Buddy Safety">
                {BUDDY_SAFETY.map((line) => (
                  <BulletItem key={line}>{line}</BulletItem>
                ))}
              </Section>
            </>
          ) : null}

          <View style={styles.divider} />

          <Pressable
            onPress={() => setAgreed((v) => !v)}
            disabled={pending}
            style={styles.agreementRow}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: agreed }}
            accessibilityLabel="I have reviewed the details and agree to the terms"
          >
            <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
              {agreed ? (
                <Ionicons name="checkmark" size={14} color={colors.white} />
              ) : null}
            </View>
            <Text style={styles.agreementText}>
              I have reviewed the {subjectNoun} details and agree to the terms and
              conditions above.
            </Text>
          </Pressable>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            onPress={onCancel}
            disabled={pending}
            style={[styles.button, styles.cancelButton]}
            accessibilityRole="button"
          >
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
          <Pressable
            onPress={onConfirm}
            disabled={!agreed || pending}
            style={[
              styles.button,
              styles.confirmButton,
              (!agreed || pending) && styles.buttonDisabled,
            ]}
            accessibilityRole="button"
          >
            {pending ? (
              <ActivityIndicator size="small" color={colors.white} />
            ) : (
              <Text style={styles.confirmText}>Confirm Match</Text>
            )}
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

interface SectionProps {
  icon: keyof typeof Ionicons.glyphMap;
  title: string;
  tone?: "danger";
  children: React.ReactNode;
}

function Section({ icon, title, tone, children }: Readonly<SectionProps>) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Ionicons
          name={icon}
          size={16}
          color={tone === "danger" ? colors.danger : colors.primary}
        />
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <View style={styles.sectionList}>{children}</View>
    </View>
  );
}

function BulletItem({
  children,
  tone,
}: Readonly<{ children: React.ReactNode; tone?: "danger" }>) {
  return (
    <View style={styles.bulletRow}>
      <View
        style={[
          styles.bulletDot,
          tone === "danger" && { backgroundColor: colors.danger },
        ]}
      />
      <Text style={styles.bulletText}>{children}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,15,25,0.45)",
  },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: "92%",
    backgroundColor: colors.card,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  headerIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceTintPrimary,
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: { color: colors.text, fontSize: 17, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 12, marginTop: 2 },

  body: { maxHeight: 480 },
  bodyContent: { paddingHorizontal: 18, paddingTop: 14, paddingBottom: 14 },

  section: { marginBottom: 12 },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  sectionTitle: { color: colors.text, fontSize: 13, fontWeight: "800" },
  sectionList: { gap: 6 },

  bulletRow: { flexDirection: "row", gap: 8, alignItems: "flex-start" },
  bulletDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 7,
  },
  bulletText: { flex: 1, color: colors.mutedText, fontSize: 13, lineHeight: 18 },

  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
    marginVertical: 4,
  },

  agreementRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    marginTop: 10,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.controlOutline,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: colors.card,
  },
  checkboxChecked: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  agreementText: {
    flex: 1,
    color: colors.text,
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "600",
  },

  footer: {
    flexDirection: "row",
    gap: 8,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 22,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    justifyContent: "flex-end",
  },
  button: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 124,
  },
  cancelButton: {
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
  },
  cancelText: { color: colors.text, fontSize: 13, fontWeight: "700" },
  confirmButton: { backgroundColor: colors.primary },
  confirmText: { color: colors.white, fontSize: 13, fontWeight: "800" },
  buttonDisabled: { opacity: 0.55 },
});
