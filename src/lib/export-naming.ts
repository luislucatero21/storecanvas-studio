import type { Device, Platform, SlideLayout } from "./types";

export function slugify(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "screenshots";
}

export function exportFileName(index: number, layout: SlideLayout) {
  return `${String(index + 1).padStart(2, "0")}-${layout}.png`;
}

export function exportPath({
  platform,
  device,
  width,
  height,
  locale,
  index,
  layout,
}: {
  platform: Platform;
  device: Device;
  width: number;
  height: number;
  locale: string;
  index: number;
  layout: SlideLayout;
}) {
  return `${platform}/${device}/${width}x${height}/${locale}/${exportFileName(index, layout)}`;
}
