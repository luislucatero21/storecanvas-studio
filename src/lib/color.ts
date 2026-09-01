export function normalizeHex(value: string | undefined, fallback = "#000000") {
  const raw = (value || "").trim().replace(/^#/, "");
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw.split("").map((channel) => channel + channel).join("")}`.toUpperCase();
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw}`.toUpperCase();
  return fallback.toUpperCase();
}

function rgbFromHex(value: string) {
  const hex = normalizeHex(value).slice(1);
  return {
    r: Number.parseInt(hex.slice(0, 2), 16),
    g: Number.parseInt(hex.slice(2, 4), 16),
    b: Number.parseInt(hex.slice(4, 6), 16),
  };
}

function channelLuminance(channel: number) {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value: string) {
  const { r, g, b } = rgbFromHex(value);
  return channelLuminance(r) * 0.2126 + channelLuminance(g) * 0.7152 + channelLuminance(b) * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const light = Math.max(relativeLuminance(first), relativeLuminance(second));
  const dark = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function rgbToHsl(value: string) {
  const { r: red, g: green, b: blue } = rgbFromHex(value);
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  const delta = max - min;
  if (delta === 0) return { h: 0, s: 0, l: lightness };
  const saturation = delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (max === r) hue = ((g - b) / delta) % 6;
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  hue = (hue * 60 + 360) % 360;
  return { h: hue, s: saturation, l: lightness };
}

function hueToRgb(p: number, q: number, t: number) {
  let value = t;
  if (value < 0) value += 1;
  if (value > 1) value -= 1;
  if (value < 1 / 6) return p + (q - p) * 6 * value;
  if (value < 1 / 2) return q;
  if (value < 2 / 3) return p + (q - p) * (2 / 3 - value) * 6;
  return p;
}

function hslToHex(hue: number, saturation: number, lightness: number) {
  const h = ((hue % 360) + 360) % 360 / 360;
  const s = Math.max(0, Math.min(1, saturation));
  const l = Math.max(0, Math.min(1, lightness));
  if (s === 0) {
    const channel = Math.round(l * 255).toString(16).padStart(2, "0");
    return `#${channel}${channel}${channel}`.toUpperCase();
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return `#${[hueToRgb(p, q, h + 1 / 3), hueToRgb(p, q, h), hueToRgb(p, q, h - 1 / 3)]
    .map((channel) => Math.round(channel * 255).toString(16).padStart(2, "0"))
    .join("")}`.toUpperCase();
}

/**
 * Keep the requested hue where possible, changing lightness only until the
 * color is readable. This is deterministic and works for exports too; it
 * does not depend on browser color APIs or an image-analysis round trip.
 */
export function accessibleColor(preferred: string, background: string, minimumRatio = 3) {
  const source = normalizeHex(preferred, "#E56750");
  const surface = normalizeHex(background, "#F3EEE6");
  if (contrastRatio(source, surface) >= minimumRatio) return source;

  const { h, s, l } = rgbToHsl(source);
  const candidates = Array.from({ length: 91 }, (_, index) => hslToHex(h, s, index / 100))
    .filter((candidate) => contrastRatio(candidate, surface) >= minimumRatio)
    .sort((a, b) => Math.abs(rgbToHsl(a).l - l) - Math.abs(rgbToHsl(b).l - l));
  if (candidates[0]) return candidates[0];

  return contrastRatio("#111827", surface) >= contrastRatio("#FFF9F0", surface)
    ? "#111827"
    : "#FFF9F0";
}

export function accentForBackground(
  preferred: string,
  background: string,
  mode: "adaptive" | "fixed" = "adaptive",
) {
  return mode === "fixed" ? normalizeHex(preferred, "#E56750") : accessibleColor(preferred, background, 3);
}
