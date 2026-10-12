import { type Dispatch, type SetStateAction } from "react";
import { BottomTabNavigationProp } from "@react-navigation/bottom-tabs";
import { RouteProp } from "@react-navigation/native";

import type { useAuth } from "@/context/AuthContext";
import { MainTabParamList } from "@/navigation/types";

export type ChatNav = BottomTabNavigationProp<MainTabParamList, "OfferChatTab">;
/** The Modals that report a failed request inline (see `modalError`). */
export type ChatModal =
  | "match"
  | "dealPicker"
  | "decline"
  | "confirm"
  | "reportMessage"
  | "reportUser"
  | "travelDoc"
  | "parcelReview";
export type ChatRoute = RouteProp<MainTabParamList, "OfferChatTab">;

/** The signed-in user as `useAuth()` returns it. */
export type ChatUser = ReturnType<typeof useAuth>["user"];

/** Shape of the inline Modal error slot (`modalError` in OfferChatScreen). */
export type ChatModalError = { modal: ChatModal; message: string } | null;
export type SetChatModalError = Dispatch<SetStateAction<ChatModalError>>;
