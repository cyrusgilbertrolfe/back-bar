/**
 * Design tokens for The Back Bar editorial look.
 *
 * Used inline across hub pages, data pages, and the calculator. Every page
 * that participates in the system references these constants rather than
 * reinventing colours and type scales.
 */

export const COLOR = {
  paper: "#F5F1EA",      // warm cream page background
  paperDeep: "#EDE7DA",  // for hover/press and subtle fills
  ink: "#1A1815",        // near-black warm
  inkSoft: "#3B362E",    // secondary text
  muted: "#6B665D",      // tertiary / captions
  mutedLight: "#8A857A", // faded
  rule: "#D9D2C5",       // hairline rule
  ruleBold: "#B8AE99",   // bolder rule (table head/foot)
  accent: "#7A5A2B",     // editorial ochre — single signal colour
  accentSoft: "#A8814C",
  flag: "#8E3A2C",       // signal red — used sparingly
  flagSoft: "#BF6A5C",
  positive: "#3F6F5A",   // muted green for positive deltas only
} as const;

export const FONT = {
  display: "var(--font-adamcg-pro), Georgia, serif", // wordmark only
  serif: "var(--font-soehne), system-ui, sans-serif", // editorial headings/italics — Söhne handles italics via kursiv
  sans: "var(--font-soehne), system-ui, sans-serif",
  mono: "var(--font-jetbrains-mono), ui-monospace, monospace",
} as const;

/** Real small-caps via OpenType feature, not text-transform. */
export const smallCaps = {
  fontFeatureSettings: '"smcp" 1, "c2sc" 1',
  textTransform: "lowercase" as const,
  letterSpacing: "0.05em",
};

export const tabularNums = {
  fontFeatureSettings: '"tnum" 1, "lnum" 1',
};
