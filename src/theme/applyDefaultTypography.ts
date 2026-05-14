import { Text, TextInput } from "react-native";
import { defaultFontFamily } from "@/theme/typography";

type WithDefaultStyle = {
  defaultProps?: { style?: unknown };
};

function mergeDefaultFontFamily(Component: WithDefaultStyle): void {
  const prev = Component.defaultProps ?? {};
  const prevStyle = prev.style;
  const font = { fontFamily: defaultFontFamily };
  let nextStyle: object | object[];
  if (prevStyle == null) {
    nextStyle = font;
  } else if (Array.isArray(prevStyle)) {
    nextStyle = [...prevStyle, font];
  } else {
    nextStyle = [prevStyle, font];
  }
  Component.defaultProps = { ...prev, style: nextStyle };
}

mergeDefaultFontFamily(Text as WithDefaultStyle);
mergeDefaultFontFamily(TextInput as WithDefaultStyle);
