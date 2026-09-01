import type { BrandTokens, Theme } from "./types";
import { DEFAULT_TYPOGRAPHY, mergeTypography } from "./typography";

/** Apply project-level brand tokens without losing the selected theme's fallbacks. */
export function applyBrandTokens(theme: Theme, brand?: BrandTokens): Theme {
  const colors = brand?.colors;
  return {
    ...theme,
    ...(colors
      ? {
          bg: colors.surface || theme.bg,
          bgAlt: colors.surfaceAlt || theme.bgAlt,
          fg: colors.ink || theme.fg,
          fgAlt: colors.inkAlt || theme.fgAlt,
          accent: colors.accent || colors.primary || theme.accent,
          muted: colors.muted || theme.muted,
        }
      : {}),
    accentMode: brand?.accentMode || theme.accentMode || "adaptive",
    typography: mergeTypography(DEFAULT_TYPOGRAPHY, theme.typography, brand?.typography),
  };
}
