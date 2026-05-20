import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LegalScreen } from "@/features/legal/LegalScreen";
import { privacySections } from "@/data/legal";
import { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "PrivacyPolicy">;

export function PrivacyPolicyScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <LegalScreen
      title="Privacy Policy"
      sections={privacySections}
      onBack={() => navigation.goBack()}
    />
  );
}
