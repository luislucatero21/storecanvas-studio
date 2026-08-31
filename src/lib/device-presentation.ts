import { getCanvas } from "./canvas";
import { IPAD_RATIO, MK_RATIO } from "./constants";
import type {
  Device,
  DeviceAnglePreset,
  DevicePresentation,
  DeviceSlot,
  ElementTransform,
  Orientation,
  Slide,
  SlotSpan,
} from "./types";

export const DEVICE_ANGLE_PRESETS: Record<Exclude<DeviceAnglePreset, "custom">, DevicePresentation> = {
  flat: { preset: "flat", rotateX: 0, rotateY: 0, perspective: 1400, depth: 0 },
  "tilt-left": { preset: "tilt-left", rotateX: 2, rotateY: -11, perspective: 2100, depth: 9 },
  "tilt-right": { preset: "tilt-right", rotateX: 2, rotateY: 11, perspective: 2100, depth: 9 },
  "low-angle": { preset: "low-angle", rotateX: -9, rotateY: -4, perspective: 1900, depth: 11 },
  "high-angle": { preset: "high-angle", rotateX: 9, rotateY: 4, perspective: 2200, depth: 8 },
};

export function presentationForPreset(preset: Exclude<DeviceAnglePreset, "custom">): DevicePresentation {
  return { ...DEVICE_ANGLE_PRESETS[preset] };
}

export function applyDeviceAngle(
  slide: Slide,
  target: "device" | "deviceSecondary" | { slotId: string },
  preset: Exclude<DeviceAnglePreset, "custom">,
): Slide {
  if (typeof target === "object") {
    return {
      ...slide,
      deviceSlots: (slide.deviceSlots || []).map((slot) =>
        slot.id === target.slotId
          ? {
              ...slot,
              presentation: {
                ...presentationForPreset(preset),
                ...(slot.presentation?.deviceModel ? { deviceModel: slot.presentation.deviceModel } : {}),
              },
            }
          : slot,
      ),
    };
  }
  const current = slide.presentations?.[target];
  return {
    ...slide,
    presentations: {
      ...(slide.presentations || {}),
      [target]: {
        ...presentationForPreset(preset),
        ...(current?.deviceModel ? { deviceModel: current.deviceModel } : {}),
      },
    },
  };
}

export function createDeviceSlot(
  slide: Slide,
  device: Device,
  orientation: Orientation,
  id: string,
): DeviceSlot {
  const { cW, cH } = getCanvas(device, orientation);
  const aspect = frameAspect(device, orientation);
  const width = Math.min(cW * 0.54, cH * aspect * 0.62);
  const existing = slide.deviceSlots?.length || 0;
  const transform: ElementTransform = {
    x: cW * (0.1 + (existing % 3) * 0.12),
    y: cH * (0.3 + (existing % 2) * 0.08),
    width,
    height: width / aspect,
    rotation: existing % 2 === 0 ? -2 : 2,
    zIndex: 5 + existing,
  };
  return {
    id,
    screenshot: slide.screenshot,
    assetRef: slide.assetRef,
    transform,
    presentation: presentationForPreset(existing % 2 === 0 ? "tilt-left" : "tilt-right"),
    spanSlots: 1,
  };
}

export function setDeviceSlotSpan(slide: Slide, slotId: string, spanSlots: SlotSpan): Slide {
  return {
    ...slide,
    deviceSlots: (slide.deviceSlots || []).map((slot) =>
      slot.id === slotId ? { ...slot, spanSlots } : slot,
    ),
  };
}

function frameAspect(device: Device, orientation: Orientation) {
  if (device === "iphone") return MK_RATIO;
  if (device === "android") return 9 / 19.5;
  if (device === "ipad") return IPAD_RATIO;
  if (device === "android-7" || device === "android-10") return orientation === "landscape" ? 8 / 5 : 5 / 8;
  return 1;
}
