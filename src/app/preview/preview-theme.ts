/**
 * Shared design tokens for the /preview editorial direction.
 *
 * Scoped to the /preview route only — existing pages are untouched.
 * If this direction is accepted, these tokens graduate into globals.css.
 */

export const COLOR = {
  paper: "#F5F1EA",     // warm cream page background
  paperDeep: "#EDE7DA", // for hover/press and subtle fills
  ink: "#1A1815",       // near-black warm
  inkSoft: "#3B362E",   // secondary text
  muted: "#6B665D",     // tertiary / captions
  mutedLight: "#8A857A",// faded
  rule: "#D9D2C5",      // hairline rule
  ruleBold: "#B8AE99",  // bolder rule (table head/foot)
  accent: "#7A5A2B",    // single editorial ochre
  accentSoft: "#A8814C",
  flag: "#8E3A2C",      // signal red — used sparingly, for failing tests only
  flagSoft: "#BF6A5C",
} as const;

export const FONT = {
  serif: "var(--font-spectral), Georgia, serif",
  sans: "var(--font-inter), system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), ui-monospace, monospace",
} as const;

/**
 * Real small-caps via OpenType feature, not text-transform + letter-spacing.
 * Pair with a small size (10-12px) and slight letter-spacing.
 */
export const smallCaps = {
  fontFeatureSettings: '"smcp" 1, "c2sc" 1',
  textTransform: "lowercase" as const,
  letterSpacing: "0.05em",
};

export const tabularNums = {
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};
