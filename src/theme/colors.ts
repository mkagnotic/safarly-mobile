/**
 * Aligned with `safarly_web` CSS variables + landing hero gradient (peach → lavender).
 * `primary` matches web `primary-deep` (icons, chrome, CTAs); `primarySoft` matches web `primary` (lavender fills).
 */
export const colors = {
  /** Fallback / flat surfaces — warm midpoint of `heroBackgroundGradient` (peach → pink → purple). Slightly deeper so white content cards stand out. */
  background: "#ECDBE4",
  /** Near-black — strong contrast on glass gradients + white cards */
  foreground: "#08070D",
  /** Web `--card` — crisp white for elevated surfaces */
  card: "#FFFFFF",
  /** Main body text (same as foreground) */
  text: "#08070D",
  /**
   * Secondary body / subtitles — darker than legacy tokens so copy stays readable on
   * peach–lavender washes and frosted chrome (WCAG-oriented vs pastel backgrounds).
   */
  mutedText: "#14121C",
  /** Captions, hints — still clearly separated from `mutedText` but AA-friendly on `#FFF1E6`–`#FFFFFF` */
  subtleText: "#3A3548",
  /**
   * Input placeholders ONLY — `foreground` at 45%, mirroring web's
   * `placeholder:text-foreground/45`.
   *
   * Deliberately lighter than every other text token: a placeholder is a hint,
   * not content. `mutedText`/`subtleText` are near-black and make an empty
   * field look pre-filled, which is especially misleading on password and
   * one-time-code inputs. Kept as rgba so it blends over whatever surface the
   * field sits on rather than assuming a white background.
   */
  placeholderText: "rgba(8, 7, 13, 0.45)",

  /** Bottom tab: active icon/label on frosted bar (dark violet, not mid lavender) */
  tabBarActive: "#1E1430",
  /** Bottom tab: inactive — darker violet-gray for contrast on light blur */
  tabBarInactive: "#383445",

  /**
   * Brand lavender — checkboxes, switches, links, CTAs, icons (`#A388FA`).
   * Gradient end is darker so filled buttons keep enough contrast with white labels.
   */
  primary: "#A388FA",
  /** Soft lavender surfaces / chips */
  primarySoft: "#EDE9FD",
  primaryForeground: "#2D1550",
  /** Paired with `primary` in gradients (buttons, pressed chrome) */
  primaryGradientEnd: "#735AD8",
  /**
   * Brand wordmark purple — the exact color baked into the "SAFARLY" wordmark
   * SVG and web `safarly_web` `BrandMark` (`text-[#A74EFF]`). Use for headings
   * that should read as brand voice (onboarding titles, etc.).
   */
  wordmark: "#A74EFF",
  /**
   * CTA accent orange — matches web `safarly_web` primary CTA
   * (`linear-gradient(180deg,#FB923C,#F97316)`). Used for high-emphasis action
   * buttons (e.g. onboarding Next / Get Started).
   */
  ctaAccent: "#F97316",

  /** Web `--secondary` */
  secondary: "#C9B8FF",
  secondaryForeground: "#221745",

  accent: "#FFF5F2",
  /** Softer violet edge on white cards — matches pastel lavender rails */
  border: "#EDE6F5",
  /**
   * Checkbox / radio unchecked ring — darker than `border` so controls stay visible
   * on peach/lavender gradients and `surfaceMuted`.
   */
  controlOutline: "#6F58C6",
  input: "#F3ECFA",
  /** Visible TextInput / OTP outline on pastel (brand hue, not flat gray). */
  inputBorder: "rgba(163, 136, 250, 0.42)",
  /** Inset fields / chips */
  surfaceMuted: "#F5EFFB",
  /** Warm peach tint for badges & empty-state icons (web landing top-left stop) */
  surfaceWarm: "#FFF1E6",
  ring: "#A388FA",

  /** Web `--sidebar-background` — wallet hero strips, dark chrome accents */
  brandDark: "#20192E",
  /** Muted label/text on `brandDark` surfaces */
  onBrandMuted: "#E2DAF2",

  safe: "#22C35D",
  warning: "#F59F0A",
  danger: "#DC2828",
  white: "#FFFFFF",

  /** Light tint behind icons — keyed off brand lavender */
  surfaceTintPrimary: "#F5F1FC",
};

/**
 * Lavender washes & strokes using brand `#A388FA` — replaces legacy `rgba(119,123,197,…)`.
 */
export const primaryTint = {
  fill08: "rgba(163, 136, 250, 0.08)",
  fill10: "rgba(163, 136, 250, 0.10)",
  fill12: "rgba(163, 136, 250, 0.12)",
  fill15: "rgba(163, 136, 250, 0.15)",
  stroke18: "rgba(163, 136, 250, 0.26)",
  stroke20: "rgba(163, 136, 250, 0.30)",
  stroke25: "rgba(163, 136, 250, 0.38)",
  stroke35: "rgba(163, 136, 250, 0.35)",
} as const;

/**
 * Root + stack + tab scene background in light mode — warm midpoint of the hero
 * wash so flashes during transitions match `heroBackgroundGradient` (no cool flash).
 */
export const screenCanvas = "#ECDBE4" as const;

/**
 * Warm hero wash — mirrors web `.gradient-bg-hero`: a peach→pink→purple diagonal
 * base plus soft corner glows. RN has no radial-gradient, so each web radial blob
 * is approximated with a corner-anchored linear gradient fading to transparent.
 * Glows are ordered topmost-first (matches web paint order).
 */
export const heroBackgroundGradient = {
  base: {
    // Deeper than the original near-white wash so white content cards read with
    // clearer separation across every page (still a soft peach→lavender pastel).
    colors: ["#F3E6DA", "#ECDBE4", "#E4D2ED"] as const,
    locations: [0, 0.55, 1] as const,
    start: { x: 0, y: 0 },
    end: { x: 1, y: 1 },
  },
  glows: [
    {
      // Glows dialed back so the corners don't wash the wash back toward white.
      colors: ["rgba(255, 220, 194, 0.6)", "rgba(255, 220, 194, 0)"] as const,
      start: { x: 0, y: 0 },
      end: { x: 0.78, y: 0.72 },
    },
    {
      colors: ["rgba(250, 209, 226, 0.55)", "rgba(250, 209, 226, 0)"] as const,
      start: { x: 1, y: 0.06 },
      end: { x: 0.28, y: 0.74 },
    },
    {
      colors: ["rgba(229, 192, 237, 0.55)", "rgba(229, 192, 237, 0)"] as const,
      start: { x: 1, y: 1 },
      end: { x: 0.2, y: 0.2 },
    },
    {
      colors: ["rgba(243, 206, 237, 0.38)", "rgba(243, 206, 237, 0)"] as const,
      start: { x: 0.38, y: 1 },
      end: { x: 0.46, y: 0.42 },
    },
  ],
} as const;

/** Frost strength (native BlurView); web uses `glassTabBarFallback` + CSS blur when available */
export const glassBlurIntensity = {
  screen: 18,
  tabBar: 38,
} as const;

/** Tab bar fill when blur/CSS blur isn’t used — frosted pastel aligned with the warm hero wash */
export const glassTabBarFallback = "rgba(236, 219, 228, 0.93)" as const;
