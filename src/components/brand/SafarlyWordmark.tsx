import { SvgXml } from "react-native-svg";
import { safarlyWordmarkXml } from "@/assets/brand/safarlyWordmark";

/** Native aspect ratio of the extracted SAFARLY wordmark (viewBox 2 335 498 74). */
const ASPECT = 498 / 74;

type Props = {
  /** Rendered width in px; height is derived from the wordmark's aspect ratio. */
  width?: number;
};

/**
 * The "SAFARLY" wordmark only — path #4 lifted verbatim from web
 * `safarly_web/public/assets/icon/safarly-logo.svg` (fill `#A74EFF`), with the
 * mark glyph and the defective stray fragment excluded. Exact web letterforms,
 * no font bundling. Stack under `SafarlyMark` for the full vertical lockup.
 */
export function SafarlyWordmark({ width = 200 }: Props) {
  return <SvgXml xml={safarlyWordmarkXml} width={width} height={width / ASPECT} />;
}
