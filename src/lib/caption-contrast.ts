import type { Theme } from "./types";

/** Resolve the foreground color that each artboard in a shared caption sits on. */
export function captionSegmentColors(
  theme: Pick<Theme, "fg" | "fgAlt">,
  invertedSegments: readonly boolean[],
) {
  const segments = invertedSegments.length ? invertedSegments : [false];
  return segments.map((inverted) => (inverted ? theme.fgAlt : theme.fg));
}

/** Create hard stops so a shared headline changes contrast exactly at each seam. */
export function captionTextGradient(colors: readonly string[]) {
  if (colors.length < 2) return undefined;
  const stops = colors.flatMap((color, index) => {
    const start = percent(index, colors.length);
    const end = percent(index + 1, colors.length);
    return `${color} ${start}%, ${color} ${end}%`;
  });
  return `linear-gradient(90deg, ${stops.join(", ")})`;
}

function percent(index: number, total: number) {
  return Number(((index / total) * 100).toFixed(4));
}
