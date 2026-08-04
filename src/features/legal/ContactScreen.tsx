import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { Linking, StyleSheet, View } from "react-native";
import { AppButton } from "@/components/ui/AppButton";
import { SUPPORT_EMAIL } from "@/constants/company";
import { contactSections } from "@/data/legal";
import { LegalScreen } from "@/features/legal/LegalScreen";
import { showToast } from "@/feedback/appFeedback";
import { RootStackParamList } from "@/navigation/types";
import { colors } from "@/theme/colors";

type Nav = NativeStackNavigationProp<RootStackParamList, "Contact">;

export function ContactScreen() {
  const navigation = useNavigation<Nav>();

  // A device with no mail client rejects the mailto — tell the user the
  // address instead of failing silently.
  const openMail = () => {
    Linking.openURL(`mailto:${SUPPORT_EMAIL}`).catch(() => {
      showToast({
        title: "No email app found",
        message: `Write to us at ${SUPPORT_EMAIL}`,
        variant: "error",
      });
    });
  };

  return (
    <LegalScreen
      title="Contact Us"
      sections={contactSections}
      onBack={() => navigation.goBack()}
      footer={
        <View style={styles.footer}>
          <AppButton
            label={`Email ${SUPPORT_EMAIL}`}
            onPress={openMail}
            leftIcon={<Ionicons name="mail-outline" size={16} color={colors.white} />}
          />
        </View>
      }
    />
  );
}

const styles = StyleSheet.create({
  footer: { marginTop: 20 },
});
