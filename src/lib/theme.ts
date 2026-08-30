import type { BrandTokens, Theme } from "./types";

/** Apply project-level brand tokens without losing the selected theme's fallbacks. */
export function applyBrandTokens(theme: Theme, brand?: BrandTokens): Theme {
  const colors = brand?.colors;
  if (!colors) return theme;
  return {
    ...theme,
    bg: colors.surface || theme.bg,
    bgAlt: colors.surfaceAlt || theme.bgAlt,
    fg: colors.ink || theme.fg,
    fgAlt: colors.inkAlt || theme.fgAlt,
    accent: colors.accent || colors.primary || theme.accent,
    muted: colors.muted || theme.muted,
  };
}
