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

/** Pin contrast changes to real artboard seams after a caption moves/resizes. */
export function captionContrastForRect(
  theme: Pick<Theme, "fg" | "fgAlt">,
  invertedArtboards: readonly boolean[],
  artboardWidth: number,
  x: number,
  width: number,
) {
  const safeWidth = Math.max(1, width);
  const left = x;
  const right = x + safeWidth;
  const boundaries = [left];
  const firstBoundary = Math.floor(left / artboardWidth) + 1;
  const lastBoundary = Math.ceil(right / artboardWidth) - 1;
  for (let index = firstBoundary; index <= lastBoundary; index += 1) {
    const boundary = index * artboardWidth;
    if (boundary > left && boundary < right) boundaries.push(boundary);
  }
  boundaries.push(right);

  const segments = boundaries.slice(0, -1).map((start, index) => {
    const end = boundaries[index + 1];
    const midpoint = start + (end - start) / 2;
    const artboard = Math.max(
      0,
      Math.min(invertedArtboards.length - 1, Math.floor(midpoint / artboardWidth)),
    );
    return {
      color: invertedArtboards[artboard] ? theme.fgAlt : theme.fg,
      start: percentFromPosition(start, left, safeWidth),
      end: percentFromPosition(end, left, safeWidth),
    };
  });
  const colors = segments.map((segment) => segment.color);
  const gradient = new Set(colors).size > 1
    ? `linear-gradient(90deg, ${segments
        .map((segment) => `${segment.color} ${segment.start}%, ${segment.color} ${segment.end}%`)
        .join(", ")})`
    : undefined;
  return { colors, gradient };
}

function percent(index: number, total: number) {
  return Number(((index / total) * 100).toFixed(4));
}

function percentFromPosition(position: number, left: number, width: number) {
  return Number((((position - left) / width) * 100).toFixed(4));
}
