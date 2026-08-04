import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LegalScreen } from "@/features/legal/LegalScreen";
import { LEGAL_EFFECTIVE_DATE, termsIntro, termsSections } from "@/data/legal";
import { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "TermsOfService">;

export function TermsOfServiceScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <LegalScreen
      title="Terms of Service"
      subtitle={`Effective Date: ${LEGAL_EFFECTIVE_DATE}`}
      intro={termsIntro}
      sections={termsSections}
      onBack={() => navigation.goBack()}
    />
  );
}
