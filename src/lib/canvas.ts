import { CANVAS } from "./constants";
import type { Device, Orientation } from "./types";

export function getCanvas(device: Device, orientation: Orientation) {
  const canvas = CANVAS[device];
  if (orientation === "landscape" && canvas.wL && canvas.hL) {
    return { cW: canvas.wL!, cH: canvas.hL! };
  }
  return { cW: canvas.w, cH: canvas.h };
}
