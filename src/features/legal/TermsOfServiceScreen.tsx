import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { LegalScreen } from "@/features/legal/LegalScreen";
import { termsSections } from "@/data/legal";
import { RootStackParamList } from "@/navigation/types";

type Nav = NativeStackNavigationProp<RootStackParamList, "TermsOfService">;

export function TermsOfServiceScreen() {
  const navigation = useNavigation<Nav>();
  return (
    <LegalScreen
      title="Terms of Service"
      sections={termsSections}
      onBack={() => navigation.goBack()}
    />
  );
}
