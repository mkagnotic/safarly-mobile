import { Image } from "react-native";

type Props = {
  size?: number;
};

export function GoogleG({ size = 18 }: Readonly<Props>) {
  return (
    <Image
      source={require("../../../assets/images/google-g.png")}
      style={{ width: size, height: size }}
      resizeMode="contain"
    />
  );
}

