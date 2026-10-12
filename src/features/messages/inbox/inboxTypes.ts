import { CompositeNavigationProp } from "@react-navigation/native";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";

import { MainTabParamList, RootStackParamList } from "@/navigation/types";

export type Nav = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList>,
  NativeStackNavigationProp<RootStackParamList>
>;

export type InboxFilter = "all" | "unread" | "requests";

export interface MiniStatus {
  label: string;
  bg: string;
  fg: string;
}

export interface ConversationFlags {
  hasUnread: boolean;
  isMatched: boolean;
  awaitingMine: boolean;
  awaitingTheirs: boolean;
  isDeclined: boolean;
  isBlocked: boolean;
  wasUnmatched: boolean;
}
