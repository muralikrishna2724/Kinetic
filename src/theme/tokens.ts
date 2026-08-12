/**
 * Kinetic design tokens.
 *
 * Single source of truth for colour, space, radius, type and motion.
 * Nothing in the app should hard-code a hex value or a magic pixel number —
 * everything routes through here so the two themes stay in lockstep.
 */

/* ------------------------------------------------------------------ *
 * Brand
 * ------------------------------------------------------------------ */

/** The Kinetic green ramp. 400/500 are the workhorses. */
export const kinetic = {
  50: '#E9FFF5',
  100: '#C4FFE5',
  200: '#8AFFCB',
  300: '#48F7AC',
  400: '#17E48F',
  500: '#00C878',
  600: '#00A462',
  700: '#00814D',
  800: '#0A6140',
  900: '#0B402C',
} as const;

/** Lime tip used at the top of brand gradients — where the energy comes from. */
export const lime = '#C6FF4D';

/** The signature three-stop gradient. Lime falls off into deep green. */
export const brandGradient = [lime, '#2BEE95', kinetic[600]] as const;

/** Flatter two-stop version for small surfaces where three stops turn to mud. */
export const brandGradientFlat = ['#8CFF6B', kinetic[500]] as const;

/* ------------------------------------------------------------------ *
 * Semantic palettes
 * ------------------------------------------------------------------ */

export type Palette = {
  /** App background, behind everything. */
  bg: string;
  /** Raised container — cards, sheets, tab bar. */
  surface: string;
  /** Recessed or secondary fill — inputs, chips, track behind a progress bar. */
  surfaceAlt: string;
  /** Highest elevation — popovers, active chip. */
  surfaceHigh: string;
  /** Hairlines and dividers. */
  border: string;
  /** Border with a bit more presence — focused/selected outline. */
  borderStrong: string;

  text: string;
  textMuted: string;
  textFaint: string;
  /** Text that sits on top of a brand-green fill. */
  onBrand: string;

  brand: string;
  brandMuted: string;
  /** Very low-alpha brand wash for tinted backgrounds. */
  brandWash: string;

  danger: string;
  warning: string;
  info: string;

  /** Shadow colour; dark mode leans on borders instead so this goes near-black. */
  shadow: string;
  /** Scrim behind modals. */
  scrim: string;
};

export const darkPalette: Palette = {
  bg: '#080B0A',
  surface: '#101514',
  surfaceAlt: '#171F1D',
  surfaceHigh: '#1E2826',
  border: '#232E2C',
  borderStrong: '#33423F',

  text: '#F2F6F4',
  textMuted: '#8DA09A',
  textFaint: '#5C6D68',
  onBrand: '#04150D',

  brand: kinetic[400],
  brandMuted: kinetic[700],
  brandWash: 'rgba(23, 228, 143, 0.10)',

  danger: '#FF5C5C',
  warning: '#FFB020',
  info: '#4DA8FF',

  shadow: '#000000',
  scrim: 'rgba(0, 0, 0, 0.65)',
};

export const lightPalette: Palette = {
  bg: '#F7FAF9',
  surface: '#FFFFFF',
  surfaceAlt: '#EFF4F2',
  surfaceHigh: '#FFFFFF',
  border: '#E2EAE7',
  borderStrong: '#CBD8D4',

  text: '#0A1310',
  textMuted: '#5E706B',
  textFaint: '#93A29D',
  onBrand: '#04150D',

  brand: kinetic[500],
  // 200 is too pale to carry data on white — chart bars and split fills
  // disappeared against the surface. 300 still reads as the quiet green next to
  // brand without competing with it.
  brandMuted: kinetic[300],
  brandWash: 'rgba(0, 200, 120, 0.10)',

  danger: '#D62E2E',
  warning: '#B26A00',
  info: '#0B6BCB',

  shadow: '#0A1310',
  scrim: 'rgba(10, 19, 16, 0.4)',
};

/* ------------------------------------------------------------------ *
 * Scale
 * ------------------------------------------------------------------ */

/** 4pt base grid. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  '4xl': 40,
  '5xl': 56,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22,
  '2xl': 28,
  pill: 999,
} as const;

/**
 * Type ramp. `metric` sizes are for the big numerals that carry a running app —
 * they get negative tracking so the digits lock together.
 */
export const type = {
  display: { size: 40, lineHeight: 44, weight: '800' as const, tracking: -1.2 },
  h1: { size: 28, lineHeight: 34, weight: '700' as const, tracking: -0.6 },
  h2: { size: 22, lineHeight: 28, weight: '700' as const, tracking: -0.4 },
  h3: { size: 17, lineHeight: 22, weight: '600' as const, tracking: -0.2 },
  body: { size: 15, lineHeight: 21, weight: '400' as const, tracking: 0 },
  bodyStrong: { size: 15, lineHeight: 21, weight: '600' as const, tracking: 0 },
  caption: { size: 13, lineHeight: 17, weight: '500' as const, tracking: 0 },
  /** All-caps micro label above a value. */
  label: { size: 11, lineHeight: 14, weight: '700' as const, tracking: 1.1 },

  metricHero: { size: 76, lineHeight: 80, weight: '800' as const, tracking: -3.5 },
  metricLg: { size: 34, lineHeight: 38, weight: '700' as const, tracking: -1.2 },
  metricMd: { size: 24, lineHeight: 28, weight: '700' as const, tracking: -0.8 },
} as const;

export type TypeToken = keyof typeof type;

/** Durations in ms. Kept short — this is a sports app, not a slideshow. */
export const motion = {
  instant: 120,
  fast: 180,
  base: 260,
  slow: 420,
} as const;

/** Minimum tappable square, per WCAG 2.1 AA target size guidance. */
export const HIT_SLOP = { top: 8, bottom: 8, left: 8, right: 8 };
export const MIN_TARGET = 44;
