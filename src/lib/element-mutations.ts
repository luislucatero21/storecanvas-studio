import {
  artworkKey,
  deviceSlotKey,
  isArtworkElementId,
  isBuiltInElementId,
  isDeviceSlotElementId,
  isTextElementId,
  textElementKey,
} from "./elements";
import type {
  BuiltInElementId,
  ConnectedArtwork,
  DeviceSlot,
  ElementId,
  Slide,
  TextElement,
} from "./types";

export type RemovedElement =
  | { kind: "text"; element: TextElement; index: number }
  | { kind: "artwork"; element: ConnectedArtwork; index: number }
  | { kind: "device-slot"; element: DeviceSlot; index: number }
  | { kind: "hidden"; elementId: BuiltInElementId };

export type ElementMutation = {
  slide: Slide;
  changed: boolean;
  action?: "removed" | "hidden";
  removed?: RemovedElement;
};

/**
 * Remove a user-owned layer, or hide a layout-owned layer. Built-in devices and
 * captions remain part of the slide model so Delete cannot corrupt a layout;
 * hiding them is the same reversible operation exposed by the inspector.
 */
export function removeElementFromSlide(
  slide: Slide,
  elementId: ElementId | string,
): ElementMutation {
  if (isTextElementId(elementId)) {
    const id = textElementKey(elementId);
    const elements = slide.textElements || [];
    const index = elements.findIndex((element) => element.id === id);
    if (index < 0) return { slide, changed: false };
    return {
      slide: {
        ...slide,
        textElements: elements.filter((element) => element.id !== id).length
          ? elements.filter((element) => element.id !== id)
          : undefined,
      },
      changed: true,
      action: "removed",
      removed: { kind: "text", element: elements[index], index },
    };
  }

  if (isArtworkElementId(elementId)) {
    const id = artworkKey(elementId);
    const elements = slide.connectedArtworks || [];
    const index = elements.findIndex((element) => element.id === id);
    if (index < 0) return { slide, changed: false };
    return {
      slide: {
        ...slide,
        connectedArtworks: elements.filter((element) => element.id !== id).length
          ? elements.filter((element) => element.id !== id)
          : undefined,
      },
      changed: true,
      action: "removed",
      removed: { kind: "artwork", element: elements[index], index },
    };
  }

  if (isDeviceSlotElementId(elementId)) {
    const id = deviceSlotKey(elementId);
    const elements = slide.deviceSlots || [];
    const index = elements.findIndex((element) => element.id === id);
    if (index < 0) return { slide, changed: false };
    return {
      slide: {
        ...slide,
        deviceSlots: elements.filter((element) => element.id !== id).length
          ? elements.filter((element) => element.id !== id)
          : undefined,
      },
      changed: true,
      action: "removed",
      removed: { kind: "device-slot", element: elements[index], index },
    };
  }

  if (isBuiltInElementId(elementId)) {
    const hidden = new Set(slide.hiddenElements || []);
    if (hidden.has(elementId)) return { slide, changed: false };
    return {
      slide: {
        ...slide,
        hiddenElements: [...hidden, elementId],
      },
      changed: true,
      action: "hidden",
      removed: { kind: "hidden", elementId },
    };
  }

  return { slide, changed: false };
}

/** Restore only the layer affected by a Delete action, preserving later edits. */
export function restoreElementOnSlide(slide: Slide, removed: RemovedElement): Slide {
  if (removed.kind === "hidden") {
    const hidden = (slide.hiddenElements || []).filter((id) => id !== removed.elementId);
    return { ...slide, hiddenElements: hidden.length ? hidden : undefined };
  }

  if (removed.kind === "text") {
    const elements = slide.textElements || [];
    if (elements.some((element) => element.id === removed.element.id)) return slide;
    const next = [...elements];
    next.splice(Math.max(0, Math.min(removed.index, next.length)), 0, removed.element);
    return { ...slide, textElements: next };
  }

  if (removed.kind === "artwork") {
    const elements = slide.connectedArtworks || [];
    if (elements.some((element) => element.id === removed.element.id)) return slide;
    const next = [...elements];
    next.splice(Math.max(0, Math.min(removed.index, next.length)), 0, removed.element);
    return { ...slide, connectedArtworks: next };
  }

  const elements = slide.deviceSlots || [];
  if (elements.some((element) => element.id === removed.element.id)) return slide;
  const next = [...elements];
  next.splice(Math.max(0, Math.min(removed.index, next.length)), 0, removed.element);
  return { ...slide, deviceSlots: next };
}
