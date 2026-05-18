import { SvgXml } from "react-native-svg";
import { safarlyMarkXml } from "@/assets/brand/safarlyMark";

/** Native aspect ratio of `safarly-mark.svg` (viewBox 120 -10 260 310). */
const ASPECT = 260 / 310;

type Props = {
  /** Rendered height in px; width is derived from the SVG's native aspect ratio. */
  size?: number;
};

/**
 * Safarly mark glyph only (purple→indigo gradient `#C084FC → #818CF8`) — a
 * pixel-faithful port of web `safarly_web/public/assets/icon/safarly-mark.svg`.
 * Use for compact / inline brand spots; pair with the wordmark via `BrandMark`.
 */
export function SafarlyMark({ size = 36 }: Props) {
  return <SvgXml xml={safarlyMarkXml} height={size} width={size * ASPECT} />;
}
