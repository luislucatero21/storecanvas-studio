import { getCanvas } from "./canvas";
import type { ConnectedArtwork, Device, Orientation, SlotSpan } from "./types";

export function createConnectedArtwork(
  device: Device,
  orientation: Orientation,
  id: string,
  image = "",
  spanSlots: SlotSpan = 2,
): ConnectedArtwork {
  const { cW, cH } = getCanvas(device, orientation);
  return {
    id,
    image,
    spanSlots,
    opacity: 1,
    transform: { x: 0, y: 0, width: cW * spanSlots, height: cH, zIndex: 1 },
  };
}

export function fitConnectedArtwork(
  artwork: ConnectedArtwork,
  device: Device,
  orientation: Orientation,
  spanSlots: SlotSpan,
): ConnectedArtwork {
  const { cW, cH } = getCanvas(device, orientation);
  return {
    ...artwork,
    spanSlots,
    transform: { x: 0, y: 0, width: cW * spanSlots, height: cH, zIndex: artwork.transform.zIndex ?? 1 },
  };
}
