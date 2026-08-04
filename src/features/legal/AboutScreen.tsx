import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LegalScreen } from "@/features/legal/LegalScreen";
import { aboutSections } from "@/data/legal";
import { copyrightLine } from "@/constants/company";
import { RootStackParamList } from "@/navigation/types";
import { StyleSheet, Text } from "react-native";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "About">;

export function AboutScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <LegalScreen
      title="About Safarly"
      sections={aboutSections}
      onBack={() => navigation.goBack()}
      footer={<Text style={styles.copyright}>{copyrightLine(new Date().getFullYear())}</Text>}
    />
  );
}

const styles = StyleSheet.create({
  copyright: {
    color: colors.mutedText,
    fontSize: 13,
    lineHeight: 20,
    textAlign: "center",
    marginTop: 20,
    paddingHorizontal: 8,
  },
});
