import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { CompositeNavigationProp, RouteProp } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { MainTabParamList, RootStackParamList } from "@/navigation/types";

export type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, "BookingsTab">,
  NativeStackNavigationProp<RootStackParamList>
>;
export type Route = RouteProp<MainTabParamList, "BookingsTab">;
