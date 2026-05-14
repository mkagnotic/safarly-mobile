/**
 * Aligned with `safarly_web` CSS variables + landing hero gradient (peach → lavender).
 * `primary` matches web `primary-deep` (icons, chrome, CTAs); `primarySoft` matches web `primary` (lavender fills).
 */
export const colors = {
  /** Fallback / flat surfaces — midpoint of `screenBackgroundGradient` (#FAF5FF → #EEF2FF) */
  background: "#F4F4FF",
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
  /** Captions, placeholders, hints — still clearly separated from `mutedText` but AA-friendly on `#FFF1E6`–`#FFFFFF` */
  subtleText: "#3A3548",

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
 * Root + stack + tab scene background in light mode — midpoint of the diagonal wash
 * (`#FAF5FF` → `#EEF2FF`) so flashes during transitions match `screenBackgroundGradient`.
 */
export const screenCanvas = "#F4F4FF" as const;

/**
 * Diagonal wash: pale violet (TL) → pale indigo (BR). Applied to every page via `Screen`.
 */
export const screenBackgroundGradient = {
  colors: ["#FAF5FF", "#EEF2FF"] as const,
  locations: [0, 1] as const,
  start: { x: 0, y: 0 },
  end: { x: 1, y: 1 },
} as const;

/** Soft cool vignette — light enough to preserve the pastel gradient (dim pulse adds depth). */
export const glassVignetteGradient = {
  colors: ["rgba(163, 136, 250, 0.05)", "rgba(255, 255, 255, 0)", "rgba(140, 155, 255, 0.07)"] as const,
  locations: [0, 0.48, 1] as const,
  start: { x: 0.5, y: 0 },
  end: { x: 0.5, y: 1 },
} as const;

/** Static mist — subtle lavender over the peach/lavender base */
export const glassAtmosphere = "rgba(115, 85, 155, 0.045)" as const;

/** Frost strength (native BlurView); web uses `glassTabBarFallback` + CSS blur when available */
export const glassBlurIntensity = {
  screen: 18,
  tabBar: 38,
} as const;

/** Tab bar fill when blur/CSS blur isn’t used — frosted pastel aligned with screen gradient */
export const glassTabBarFallback = "rgba(244, 244, 255, 0.93)" as const;

/** Breathing dim overlay — capped low so the underlying screen gradient stays clearly visible. */
export const glassDimPulse = {
  /** One half-cycle (dim up or dim down); full breath ≈ 2× this — slightly slower = fewer layout passes */
  durationMs: 3400,
  /** Soft swing — small enough not to wash out the #FAF5FF → #EEF2FF gradient at peak */
  opacityMin: 0.0,
  opacityMax: 0.06,
  /** Soft indigo mist — keyed to the cool gradient endpoints */
  layer: "#E0E4FF" as const,
} as const;

/**
 * Splash screen — same diagonal wash as `screenBackgroundGradient` so the first paint and
 * transition into onboarding/home match the cool violet–indigo shell (no dark flash).
 */
export const splashBackgroundGradient = screenBackgroundGradient;
