import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { MainTabParamList, RootStackParamList } from "@/navigation/types";

export type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type TabKey = "flights" | "packages" | "partners" | "archive";

export interface TabConfig {
  key: TabKey;
  label: string;
  count?: number;
}
