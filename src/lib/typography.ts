import type { TypographyStyle, TypographyTokens } from "./types";

export type FontOption = {
  id: string;
  label: string;
  family: string;
  category: "sans" | "serif" | "system";
  license: string;
  sourceUrl?: string;
};

/**
 * Fonts are either bundled through next/font or supplied by the operating
 * system. The persisted value is a stable id, so a project never depends on
 * a remote stylesheet or an unlicensed font name.
 */
export const FONT_OPTIONS: FontOption[] = [
  {
    id: "dm-sans",
    label: "DM Sans",
    family: "var(--font-dm-sans), \"DM Sans\", sans-serif",
    category: "sans",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/dmsans",
  },
  {
    id: "manrope",
    label: "Manrope",
    family: "var(--font-manrope), Manrope, sans-serif",
    category: "sans",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/manrope",
  },
  {
    id: "space-grotesk",
    label: "Space Grotesk",
    family: "var(--font-space-grotesk), \"Space Grotesk\", sans-serif",
    category: "sans",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/floriankarsten/space-grotesk",
  },
  {
    id: "source-sans-3",
    label: "Source Sans 3",
    family: "var(--font-source-sans-3), \"Source Sans 3\", sans-serif",
    category: "sans",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/sourcesans3",
  },
  {
    id: "inter",
    label: "Inter",
    family: "var(--font-inter), Inter, sans-serif",
    category: "sans",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/inter",
  },
  {
    id: "fraunces",
    label: "Fraunces",
    family: "var(--font-fraunces), Fraunces, Georgia, serif",
    category: "serif",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/fraunces",
  },
  {
    id: "instrument-serif",
    label: "Instrument Serif",
    family: "var(--font-instrument-serif), \"Instrument Serif\", Georgia, serif",
    category: "serif",
    license: "SIL OFL 1.1",
    sourceUrl: "https://github.com/google/fonts/tree/main/ofl/instrumentserif",
  },
  {
    id: "serif",
    label: "Georgia / system serif",
    family: "Georgia, \"Times New Roman\", serif",
    category: "serif",
    license: "Operating system font",
  },
  {
    id: "system",
    label: "System / SF Pro",
    family: "ui-sans-serif, -apple-system, BlinkMacSystemFont, \"Segoe UI\", sans-serif",
    category: "system",
    license: "Operating system font",
  },
];

export const DEFAULT_TYPOGRAPHY: TypographyTokens = {
  display: { family: "fraunces", weight: 700, sizeScale: 1 },
  body: { family: "dm-sans", weight: 500, sizeScale: 1 },
};

export const FONT_WEIGHT_OPTIONS = [
  { value: 400, label: "Regular" },
  { value: 500, label: "Medium" },
  { value: 600, label: "Semibold" },
  { value: 700, label: "Bold" },
  { value: 800, label: "Heavy" },
] as const;

export const TYPOGRAPHY_SCALE_OPTIONS = [
  { value: 0.86, label: "Compact" },
  { value: 1, label: "Standard" },
  { value: 1.14, label: "Large" },
  { value: 1.28, label: "Hero" },
] as const;

const FONT_ALIASES: Record<string, string> = {
  "dm sans": "dm-sans",
  dmsans: "dm-sans",
  fraunces: "fraunces",
  manrope: "manrope",
  "space grotesk": "space-grotesk",
  spacegrotesk: "space-grotesk",
  "source sans 3": "source-sans-3",
  sourcesans3: "source-sans-3",
  "instrument serif": "instrument-serif",
  instrumentserif: "instrument-serif",
  inter: "inter",
  georgia: "serif",
  "times new roman": "serif",
  system: "system",
  "system ui": "system",
  "sf pro": "system",
};

export function fontOptionById(id: string | undefined) {
  return FONT_OPTIONS.find((option) => option.id === id);
}

/** Accepts both current stable ids and older human-readable family names. */
export function fontOptionId(value: string | undefined, fallback = "dm-sans") {
  if (!value) return fallback;
  const normalized = value.trim().toLowerCase().replace(/["']/g, "");
  if (fontOptionById(normalized)) return normalized;
  return FONT_ALIASES[normalized] || fallback;
}

export function fontFamilyCss(value: string | undefined, role: "display" | "body" = "body") {
  const fallback = role === "display" ? "fraunces" : "dm-sans";
  return fontOptionById(fontOptionId(value, fallback))?.family || fontOptionById(fallback)!.family;
}

export function mergeTypography(...sources: Array<TypographyTokens | undefined>): TypographyTokens {
  const merged: TypographyTokens = {};
  for (const source of sources) {
    if (!source) continue;
    for (const role of ["display", "body", "label", "headline", "text"] as const) {
      if (source[role]) merged[role] = { ...merged[role], ...source[role] };
    }
  }
  return merged;
}

/** Resolve a semantic role while allowing label/headline-specific overrides. */
export function typographyForRole(
  typography: TypographyTokens | undefined,
  role: "label" | "headline" | "text",
): TypographyStyle {
  const base = role === "headline" ? typography?.display : typography?.body;
  return { ...(base || {}), ...(typography?.[role] || {}) };
}

export function clampSizeScale(value: number | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 1;
  return Math.max(0.7, Math.min(1.5, value));
}
