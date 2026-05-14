import { Pressable as RNPressable, type PressableProps, type StyleProp, type ViewStyle } from "react-native";

const PRESSED_STYLE: ViewStyle = {
  transform: [{ scale: 0.97 }],
  opacity: 0.85,
};

export function AppPressable({ style, android_ripple, ...props }: Readonly<PressableProps>) {
  return (
    <RNPressable
      {...props}
      android_ripple={android_ripple ?? { color: "rgba(255,255,255,0.16)" }}
      style={(state) => {
        const baseStyle: StyleProp<ViewStyle> = typeof style === "function" ? style(state) : style;
        return state.pressed ? [baseStyle, PRESSED_STYLE] : baseStyle;
      }}
    />
  );
}
