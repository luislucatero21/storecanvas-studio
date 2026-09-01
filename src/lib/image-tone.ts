import { normalizeHex } from "./color";

export type ToneRect = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type ArtworkToneOptions = {
  source: string;
  deckLength: number;
  artboardWidth: number;
  artworkRect: ToneRect;
  baseColors: readonly string[];
  sampleRegions?: readonly (ToneRect | undefined)[];
  artworkOpacity?: number;
  overlayOpacity?: number;
};

type RGB = { r: number; g: number; b: number };
const toneCache = new Map<string, Promise<Array<string | undefined> | null>>();

/**
 * Sample the visible tone of a connected artwork once per artboard.
 *
 * The editor's `inverted` flag is a layout hint, not a reliable description
 * of a generated image. Sampling the actual pixels keeps adaptive text color
 * correct when a panorama crosses a light/dark seam at a different point.
 * The function is browser-only by design and safely returns null during SSR,
 * for unsupported image sources, or when a remote image disallows canvas
 * access.
 */
export function sampleArtworkBackgrounds(
  options: ArtworkToneOptions,
): Promise<Array<string | undefined> | null> {
  if (
    typeof window === "undefined" ||
    typeof document === "undefined" ||
    !options.source ||
    options.deckLength < 1 ||
    options.artboardWidth <= 0 ||
    options.artworkRect.width <= 0 ||
    options.artworkRect.height <= 0
  ) {
    return Promise.resolve(null);
  }

  const cacheKey = JSON.stringify({
    source: options.source,
    deckLength: options.deckLength,
    artboardWidth: options.artboardWidth,
    artworkRect: options.artworkRect,
    baseColors: options.baseColors,
    sampleRegions: options.sampleRegions,
    artworkOpacity: options.artworkOpacity,
    overlayOpacity: options.overlayOpacity,
  });
  const cached = toneCache.get(cacheKey);
  if (cached) return cached;

  const promise = new Promise<Array<string | undefined> | null>((resolve) => {
    const image = document.createElement("img");
    let settled = false;

    const finish = (value: Array<string | undefined> | null) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };

    const sample = () => {
      if (settled) return;
      try {
        const naturalWidth = image.naturalWidth || image.width;
        const naturalHeight = image.naturalHeight || image.height;
        if (!naturalWidth || !naturalHeight) {
          finish(null);
          return;
        }

        const scale = Math.min(1, 768 / naturalWidth);
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(naturalHeight * scale));
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) {
          finish(null);
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);

        const deckLength = Math.max(1, Math.floor(options.deckLength));
        const artwork = options.artworkRect;
        const coverScale = Math.max(
          artwork.width / naturalWidth,
          artwork.height / naturalHeight,
        );
        const renderedWidth = naturalWidth * coverScale;
        const renderedHeight = naturalHeight * coverScale;
        const offsetX = (artwork.width - renderedWidth) / 2;
        const offsetY = (artwork.height - renderedHeight) / 2;
        const artworkOpacity = clamp(options.artworkOpacity ?? 1, 0, 1);
        const overlayOpacity = clamp(options.overlayOpacity ?? 0.18, 0, 1);
        const backgrounds = Array.from({ length: deckLength }, (_, index) => {
          const slot = {
            x: index * options.artboardWidth,
            y: 0,
            width: options.artboardWidth,
            height: artwork.height,
          };
          const candidateRegions = (options.sampleRegions || [])
            .filter((region): region is ToneRect => {
              if (!region) return false;
              return intersects(region, slot) && intersects(region, artwork);
            })
            .map((region) => intersection(region, slot));
          const regions = candidateRegions.length
            ? candidateRegions
            : [intersection(slot, artwork)];
          const samples = regions
            .map((region) => sampleRegion({
              context,
              region,
              artwork,
              naturalWidth,
              naturalHeight,
              coverScale,
              offsetX,
              offsetY,
              canvasScale: scale,
              canvasWidth: canvas.width,
              canvasHeight: canvas.height,
            }))
            .filter((value): value is RGB => Boolean(value));
          if (!samples.length) return undefined;

          const imageColor = averageRgb(samples);
          const baseColor = parseHex(options.baseColors[index] || options.baseColors[0] || "#F3EEE6");
          const withArtworkOpacity = mixRgb(imageColor, baseColor, 1 - artworkOpacity);
          const withOverlay = mixRgb(withArtworkOpacity, baseColor, overlayOpacity);
          return rgbToHex(withOverlay);
        });

        finish(backgrounds);
      } catch {
        // A cross-origin image without CORS headers taints the canvas. The
        // renderer will fall back to the deterministic inverted theme path.
        finish(null);
      }
    };

    image.onload = sample;
    image.onerror = () => finish(null);
    if (/^https?:\/\//i.test(options.source)) image.crossOrigin = "anonymous";
    image.src = options.source;
    if (image.complete) window.setTimeout(sample, 0);
  });
  toneCache.set(cacheKey, promise);
  if (toneCache.size > 32) {
    const oldest = toneCache.keys().next().value;
    if (typeof oldest === "string") toneCache.delete(oldest);
  }
  return promise;
}

function sampleRegion({
  context,
  region,
  artwork,
  naturalWidth,
  naturalHeight,
  coverScale,
  offsetX,
  offsetY,
  canvasScale,
  canvasWidth,
  canvasHeight,
}: {
  context: CanvasRenderingContext2D;
  region: ToneRect;
  artwork: ToneRect;
  naturalWidth: number;
  naturalHeight: number;
  coverScale: number;
  offsetX: number;
  offsetY: number;
  canvasScale: number;
  canvasWidth: number;
  canvasHeight: number;
}): RGB | null {
  if (region.width <= 0 || region.height <= 0) return null;
  const sourceLeft = Math.max(0, (region.x - artwork.x - offsetX) / coverScale);
  const sourceTop = Math.max(0, (region.y - artwork.y - offsetY) / coverScale);
  const sourceRight = Math.min(
    naturalWidth,
    (region.x + region.width - artwork.x - offsetX) / coverScale,
  );
  const sourceBottom = Math.min(
    naturalHeight,
    (region.y + region.height - artwork.y - offsetY) / coverScale,
  );
  if (sourceRight <= sourceLeft || sourceBottom <= sourceTop) return null;

  const left = clamp(Math.floor(sourceLeft * canvasScale), 0, canvasWidth - 1);
  const top = clamp(Math.floor(sourceTop * canvasScale), 0, canvasHeight - 1);
  const right = clamp(Math.ceil(sourceRight * canvasScale), left + 1, canvasWidth);
  const bottom = clamp(Math.ceil(sourceBottom * canvasScale), top + 1, canvasHeight);
  const pixels = context.getImageData(left, top, right - left, bottom - top).data;
  let red = 0;
  let green = 0;
  let blue = 0;
  let weight = 0;
  for (let index = 0; index < pixels.length; index += 4) {
    const alpha = pixels[index + 3] / 255;
    if (!alpha) continue;
    red += pixels[index] * alpha;
    green += pixels[index + 1] * alpha;
    blue += pixels[index + 2] * alpha;
    weight += alpha;
  }
  return weight
    ? { r: red / weight, g: green / weight, b: blue / weight }
    : null;
}

function intersects(first: ToneRect, second: ToneRect) {
  return (
    first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y
  );
}

function intersection(first: ToneRect, second: ToneRect): ToneRect {
  const left = Math.max(first.x, second.x);
  const top = Math.max(first.y, second.y);
  const right = Math.min(first.x + first.width, second.x + second.width);
  const bottom = Math.min(first.y + first.height, second.y + second.height);
  return { x: left, y: top, width: Math.max(0, right - left), height: Math.max(0, bottom - top) };
}

function parseHex(value: string): RGB {
  const hex = normalizeHex(value, "#F3EEE6").slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function averageRgb(values: readonly RGB[]): RGB {
  const total = values.reduce(
    (sum, value) => ({ r: sum.r + value.r, g: sum.g + value.g, b: sum.b + value.b }),
    { r: 0, g: 0, b: 0 },
  );
  return { r: total.r / values.length, g: total.g / values.length, b: total.b / values.length };
}

function mixRgb(first: RGB, second: RGB, secondWeight: number): RGB {
  const weight = clamp(secondWeight, 0, 1);
  return {
    r: first.r * (1 - weight) + second.r * weight,
    g: first.g * (1 - weight) + second.g * weight,
    b: first.b * (1 - weight) + second.b * weight,
  };
}

function rgbToHex(value: RGB) {
  return `#${[value.r, value.g, value.b]
    .map((channel) => clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
