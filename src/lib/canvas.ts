import { CANVAS } from "./constants";
import type { Device, Orientation } from "./types";

export function getCanvas(device: Device, orientation: Orientation) {
  const canvas = CANVAS[device];
  if ((device === "android-7" || device === "android-10") && orientation === "landscape") {
    return { cW: canvas.wL!, cH: canvas.hL! };
  }
  return { cW: canvas.w, cH: canvas.h };
}
