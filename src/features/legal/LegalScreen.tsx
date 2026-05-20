import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { AppPressable as Pressable } from "@/components/ui/AppPressable";
import { Screen } from "@/components/ui/Screen";
import { LEGAL_EFFECTIVE_DATE, type LegalSection } from "@/data/legal";
import { colors } from "@/theme/colors";

type Props = {
  title: string;
  sections: readonly LegalSection[];
  onBack: () => void;
};

export function LegalScreen({ title, sections, onBack }: Readonly<Props>) {
  return (
    <Screen
      edges={["top", "right", "left", "bottom"]}
      contentContainerStyle={styles.contentContainer}
      refreshEnabled={false}
    >
      <View style={styles.headerRow}>
        <Pressable
          style={styles.backButton}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="chevron-back" size={18} color={colors.text} />
        </Pressable>
        <Text style={styles.screenTitle}>{title}</Text>
      </View>
      <Text style={styles.subtitle}>Effective Date: {LEGAL_EFFECTIVE_DATE}</Text>

      <View style={styles.card}>
        {sections.map((section, index) => (
          <View
            key={section.title}
            style={[styles.section, index > 0 && styles.sectionDivider]}
          >
            <Text style={styles.sectionTitle}>{section.title}</Text>
            {section.paragraphs?.map((p) => (
              <Text key={p} style={styles.paragraph}>
                {p}
              </Text>
            ))}
            {section.bullets?.length ? (
              <View style={styles.bulletList}>
                {section.bullets.map((b) => (
                  <View key={b} style={styles.bulletRow}>
                    <View style={styles.bulletDot} />
                    <Text style={styles.bulletText}>{b}</Text>
                  </View>
                ))}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  contentContainer: { paddingBottom: 40 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 16,
    marginBottom: 18,
    minHeight: 34,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceMuted,
    alignItems: "center",
    justifyContent: "center",
  },
  screenTitle: { color: colors.text, fontSize: 24, lineHeight: 30, fontWeight: "800" },
  subtitle: { color: colors.mutedText, fontSize: 14, lineHeight: 20, fontWeight: "500", marginBottom: 22 },
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 18,
    paddingVertical: 4,
  },
  section: { paddingVertical: 18, gap: 10 },
  sectionDivider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  sectionTitle: { color: colors.text, fontSize: 17, fontWeight: "700", lineHeight: 23 },
  paragraph: { color: colors.mutedText, fontSize: 15, lineHeight: 23 },
  bulletList: { gap: 8, marginTop: 2 },
  bulletRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingRight: 4 },
  bulletDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: colors.primary,
    marginTop: 9,
  },
  bulletText: { color: colors.mutedText, fontSize: 15, lineHeight: 23, flex: 1 },
});
