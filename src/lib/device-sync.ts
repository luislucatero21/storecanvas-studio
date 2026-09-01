import { getCanvas } from "./canvas";
import { fitConnectedArtwork } from "./connected-artwork";
import type {
  AssetLibrary,
  ConnectedArtwork,
  Device,
  ElementId,
  ElementTransform,
  ProjectState,
  Slide,
  TextElement,
} from "./types";

const DEVICE_PATH = /\/apple\/(iphone|ipad)(?=\/|$)/g;

function adaptDevicePath(path: string, sourceDevice: Device, targetDevice: Device) {
  if (sourceDevice === targetDevice || !path) return path;
  if (sourceDevice === "iphone" && targetDevice === "ipad") {
    return path.replace(DEVICE_PATH, `/apple/${targetDevice}`);
  }
  return path;
}

function scaleTransform(
  transform: ElementTransform,
  sourceDevice: Device,
  targetDevice: Device,
): ElementTransform {
  const source = getCanvas(sourceDevice, "portrait");
  const target = getCanvas(targetDevice, "portrait");
  const scaleX = target.cW / source.cW;
  const scaleY = target.cH / source.cH;
  return {
    ...transform,
    x: transform.x * scaleX,
    y: transform.y * scaleY,
    width: transform.width * scaleX,
    height: transform.height * scaleY,
  };
}

function cloneElementId(id: string, targetDevice: Device): ElementId {
  const prefixes = ["slot:", "text:", "artwork:"];
  const prefix = prefixes.find((candidate) => id.startsWith(candidate));
  return (prefix ? `${prefix}${id.slice(prefix.length)}-${targetDevice}` : id) as ElementId;
}

function cloneAssetReference(
  ref: string | undefined,
  targetDevice: Device,
  sourceDevice: Device,
  assets: AssetLibrary,
  clonedRefs: Map<string, string>,
) {
  if (!ref) return undefined;
  const cached = clonedRefs.get(ref);
  if (cached) return cached;

  const targetRef = `${ref}:${targetDevice}`;
  const sourceRef = ref;
  const sourceAsset = assets[sourceRef];
  if (sourceAsset) {
    assets[targetRef] = {
      ...sourceAsset,
      id: targetRef,
      paths: Object.fromEntries(
        Object.entries(sourceAsset.paths).map(([locale, path]) => [
          locale,
          adaptDevicePath(path || "", sourceDevice, targetDevice),
        ]),
      ),
    };
  }
  clonedRefs.set(sourceRef, targetRef);
  return targetRef;
}

function cloneTextElement(
  element: TextElement,
  sourceDevice: Device,
  targetDevice: Device,
): TextElement {
  return {
    ...element,
    id: `${element.id}-${targetDevice}`,
    text: { ...element.text },
    transform: scaleTransform(element.transform, sourceDevice, targetDevice),
  };
}

function cloneSlide(
  slide: Slide,
  sourceDevice: Device,
  targetDevice: Device,
  sourceSlideCount: number,
  sourceSlideIndex: number,
  assets: AssetLibrary,
  clonedRefs: Map<string, string>,
): Slide {
  const mapAsset = (ref: string | undefined) =>
    cloneAssetReference(ref, targetDevice, sourceDevice, assets, clonedRefs);
  const transforms = slide.transforms
    ? Object.fromEntries(
        Object.entries(slide.transforms).map(([id, transform]) => [
          id,
          scaleTransform(transform, sourceDevice, targetDevice),
        ]),
      ) as Slide["transforms"]
    : undefined;
  const constraints = slide.constraints
    ? Object.fromEntries(
        Object.entries(slide.constraints).map(([id, constraint]) => [
          cloneElementId(id, targetDevice),
          { ...constraint },
        ]),
      ) as Slide["constraints"]
    : undefined;
  const responsive = slide.responsive
    ? Object.fromEntries(
        Object.entries(slide.responsive).map(([id, overrides]) => [
          cloneElementId(id, targetDevice),
          { ...overrides },
        ]),
      ) as Slide["responsive"]
    : undefined;
  const remainingSlides = Math.max(1, sourceSlideCount - sourceSlideIndex);
  const captionSpan = slide.captionSpan
    ? Math.min(slide.captionSpan, remainingSlides) as Slide["captionSpan"]
    : undefined;

  return {
    ...slide,
    id: `${slide.id}-${targetDevice}`,
    label: { ...slide.label },
    headline: { ...slide.headline },
    screenshot: adaptDevicePath(slide.screenshot, sourceDevice, targetDevice),
    ...(slide.screenshotSecondary
      ? { screenshotSecondary: adaptDevicePath(slide.screenshotSecondary, sourceDevice, targetDevice) }
      : {}),
    ...(slide.assetRef ? { assetRef: mapAsset(slide.assetRef) } : {}),
    ...(slide.assetRefSecondary ? { assetRefSecondary: mapAsset(slide.assetRefSecondary) } : {}),
    ...(slide.deviceSlots
      ? {
          deviceSlots: slide.deviceSlots.map((slot) => ({
            ...slot,
            id: `${slot.id}-${targetDevice}`,
            screenshot: adaptDevicePath(slot.screenshot, sourceDevice, targetDevice),
            ...(slot.assetRef ? { assetRef: mapAsset(slot.assetRef) } : {}),
            transform: scaleTransform(slot.transform, sourceDevice, targetDevice),
            ...(slot.presentation ? { presentation: { ...slot.presentation } } : {}),
          })),
        }
      : {}),
    ...(slide.connectedArtworks
      ? {
          connectedArtworks: slide.connectedArtworks.map((artwork) =>
            fitConnectedArtwork(
              {
                ...artwork,
                id: `${artwork.id}-${targetDevice}`,
                image: adaptDevicePath(artwork.image, sourceDevice, targetDevice),
                ...(artwork.assetRef ? { assetRef: mapAsset(artwork.assetRef) } : {}),
              },
              targetDevice,
              "portrait",
              Math.max(1, Math.min(artwork.spanSlots, remainingSlides)) as ConnectedArtwork["spanSlots"],
            ),
          ),
        }
      : {}),
    ...(captionSpan && captionSpan > 1 ? { captionSpan } : { captionSpan: undefined }),
    ...(transforms ? { transforms } : {}),
    ...(slide.textElements
      ? { textElements: slide.textElements.map((element) => cloneTextElement(element, sourceDevice, targetDevice)) }
      : {}),
    ...(constraints ? { constraints } : {}),
    ...(responsive ? { responsive } : {}),
    ...(slide.hiddenElements
      ? { hiddenElements: slide.hiddenElements.map((id) => cloneElementId(id, targetDevice)) }
      : {}),
    ...(slide.lockedElements
      ? { lockedElements: slide.lockedElements.map((id) => cloneElementId(id, targetDevice)) }
      : {}),
  };
}

function isPlaceholderSlide(slide: Slide) {
  return !slide.screenshot
    && !slide.screenshotSecondary
    && !slide.assetRef
    && !slide.assetRefSecondary
    && !(slide.deviceSlots || []).some((slot) => slot.screenshot || slot.assetRef)
    && !(slide.connectedArtworks || []).some((artwork) => artwork.image || artwork.assetRef);
}

/** True when the target deck is empty or only contains starter placeholders. */
export function shouldInheritDeviceDeck(sourceSlides: Slide[], targetSlides: Slide[]) {
  return sourceSlides.length > 0 && (targetSlides.length === 0 || targetSlides.every(isPlaceholderSlide));
}

/**
 * Create an independent target-device deck from the source deck. Asset refs,
 * layer ids and transforms are cloned so editing the iPad never mutates iPhone.
 * Device-specific App Store paths are rewritten when the target capture exists.
 */
export function cloneDeckToDevice(
  project: ProjectState,
  sourceDevice: Device = "iphone",
  targetDevice: Device = "ipad",
  maxSlides?: number,
): ProjectState {
  const sourceSlides = (project.slidesByDevice[sourceDevice] || []).slice(0, maxSlides);
  if (!sourceSlides.length) return project;
  const assets: AssetLibrary = Object.fromEntries(
    Object.entries(project.assets || {}).map(([id, asset]) => [id, { ...asset, paths: { ...asset.paths } }]),
  );
  const clonedRefs = new Map<string, string>();
  const slides = sourceSlides.map((slide, index) =>
    cloneSlide(slide, sourceDevice, targetDevice, sourceSlides.length, index, assets, clonedRefs),
  );
  return {
    ...project,
    assets: Object.keys(assets).length > 0 ? assets : project.assets,
    slidesByDevice: {
      ...project.slidesByDevice,
      [targetDevice]: slides,
    },
  };
}

/**
 * Apply the default iPhone story to empty device decks while keeping each
 * target independent after hydration. This makes the checked-in example and
 * a new local project useful on every supported portrait device without
 * making users duplicate their captures by hand.
 */
export function inheritDefaultDeviceDecks(project: ProjectState) {
  let next = project;
  for (const targetDevice of ["ipad", "android", "android-7", "android-10"] as const) {
    const sourceSlides = next.slidesByDevice.iphone || [];
    const targetSlides = next.slidesByDevice[targetDevice] || [];
    if (shouldInheritDeviceDeck(sourceSlides, targetSlides)) {
      const maxSlides = targetDevice === "ipad" ? undefined : 8;
      next = cloneDeckToDevice(next, "iphone", targetDevice, maxSlides);
    }
  }
  return next;
}
