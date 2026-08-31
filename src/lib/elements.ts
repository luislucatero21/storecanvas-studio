import type { ArtworkElementId, BuiltInElementId, DeviceSlotElementId, ElementId, TextElementId } from "./types";

export const BUILT_IN_ELEMENT_IDS: BuiltInElementId[] = [
  "caption",
  "device",
  "deviceSecondary",
];

export const TEXT_ELEMENT_PREFIX = "text:";
export const DEVICE_SLOT_PREFIX = "slot:";
export const ARTWORK_PREFIX = "artwork:";

export function isBuiltInElementId(id: ElementId | string): id is BuiltInElementId {
  return (BUILT_IN_ELEMENT_IDS as string[]).includes(id);
}

export function isTextElementId(id: ElementId | string | null | undefined): id is TextElementId {
  return typeof id === "string" && id.startsWith(TEXT_ELEMENT_PREFIX);
}

export function toTextElementId(id: string): TextElementId {
  return `${TEXT_ELEMENT_PREFIX}${id}` as TextElementId;
}

export function textElementKey(id: TextElementId | ElementId): string {
  return isTextElementId(id) ? id.slice(TEXT_ELEMENT_PREFIX.length) : id;
}

export function isDeviceSlotElementId(id: ElementId | string | null | undefined): id is DeviceSlotElementId {
  return typeof id === "string" && id.startsWith(DEVICE_SLOT_PREFIX);
}

export function toDeviceSlotElementId(id: string): DeviceSlotElementId {
  return `${DEVICE_SLOT_PREFIX}${id}` as DeviceSlotElementId;
}

export function deviceSlotKey(id: DeviceSlotElementId | ElementId): string {
  return isDeviceSlotElementId(id) ? id.slice(DEVICE_SLOT_PREFIX.length) : id;
}

export function isArtworkElementId(id: ElementId | string | null | undefined): id is ArtworkElementId {
  return typeof id === "string" && id.startsWith(ARTWORK_PREFIX);
}

export function toArtworkElementId(id: string): ArtworkElementId {
  return `${ARTWORK_PREFIX}${id}` as ArtworkElementId;
}

export function artworkKey(id: ArtworkElementId | ElementId): string {
  return isArtworkElementId(id) ? id.slice(ARTWORK_PREFIX.length) : id;
}
