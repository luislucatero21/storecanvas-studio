import { getCanvas } from "./canvas";
import { supportsLandscape } from "./constants";
import { createConnectedArtwork } from "./connected-artwork";
import { replaceAssetPath } from "./asset-library";
import { writeLinkedCopy } from "./copy-sync";
import { removeElementFromSlide } from "./element-mutations";
import {
  CAMPAIGN_TEMPLATES,
  PALETTE_PRESETS,
  applyCampaignTemplate,
  applyCampaignTemplateDefinition,
  applyPalette,
  campaignTemplateById,
  paletteById,
} from "./campaign-presets";
import type { Device, ElementId, Orientation, ProjectState, Slide, SlideLayout, SlotSpan } from "./types";

export type AgentTone = "light" | "dark" | "mixed";

export type AgentTemplateOptions = {
  applyRecommendedPalette?: boolean;
  resetCustomizations?: boolean;
  reflowConnectedArtwork?: boolean;
  paletteId?: string;
};

export type GeneratedArtworkOptions = {
  device: Device;
  startIndex: number;
  spanSlots: SlotSpan;
  image: string;
  artworkId?: string;
  assetRef?: string;
};

export type RemoveElementOptions = {
  device: Device;
  elementId: ElementId | string;
  screenIndex?: number;
};

export const AGENT_DEVICES: Device[] = ["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"];
export const AGENT_LAYOUTS: SlideLayout[] = [
  "hero",
  "device-bottom",
  "device-top",
  "two-devices",
  "no-device",
  "split-landscape",
  "feature-graphic",
];

function editDistance(a: string, b: string) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

/** Nearest known id for typo hints, or undefined when nothing is plausibly close. */
export function closestId(value: string, ids: string[]): string | undefined {
  let best: string | undefined;
  let bestDistance = Infinity;
  for (const id of ids) {
    const distance = editDistance(value.toLowerCase(), id.toLowerCase());
    if (distance < bestDistance) {
      best = id;
      bestDistance = distance;
    }
  }
  if (best && bestDistance <= Math.max(3, Math.floor(value.length / 3))) return best;
  // Agents often type a shortened or slightly misspelled id ("afterglw"), so
  // also compare against each id's prefix of the same length.
  const needle = value.toLowerCase();
  return ids.find((id) => needle.length >= 4 && editDistance(needle, id.toLowerCase().slice(0, needle.length)) <= 1);
}

function didYouMean(value: string, ids: string[]) {
  const match = closestId(value, ids);
  return match ? ` Did you mean ${match}?` : "";
}

export function resolveAgentTemplate(project: ProjectState, templateId: string) {
  if (project.customTemplate?.id === templateId) return project.customTemplate;
  return campaignTemplateById(templateId);
}

export function resolveAgentPalette(paletteId: string) {
  return paletteById(paletteId);
}

export function applyAgentTemplate(
  project: ProjectState,
  templateId: string,
  device: Device,
  options: AgentTemplateOptions = {},
): ProjectState {
  const template = resolveAgentTemplate(project, templateId);
  if (!template) throw new Error(
    `Unknown campaign template: ${templateId}.${didYouMean(templateId, [
      ...CAMPAIGN_TEMPLATES.map((candidate) => candidate.id),
      ...(project.customTemplate ? [project.customTemplate.id] : []),
    ])}`,
  );

  let next = project.customTemplate?.id === template.id
    ? applyCampaignTemplateDefinition(project, template, device, options)
    : applyCampaignTemplate(project, template.id, device, options);

  if (options.paletteId) {
    if (!resolveAgentPalette(options.paletteId)) {
      throw new Error(`Unknown palette: ${options.paletteId}.${didYouMean(options.paletteId, PALETTE_PRESETS.map((candidate) => candidate.id))}`);
    }
    next = applyPalette(next, options.paletteId);
  } else if (options.applyRecommendedPalette) {
    next = applyPalette(next, template.recommendedPaletteId);
  }

  return next;
}

export function assertConnectedArtworkRange(
  project: ProjectState,
  device: Device,
  startIndex: number,
  spanSlots: number,
) {
  const slides = project.slidesByDevice[device] || [];
  if (!Number.isInteger(startIndex) || startIndex < 0) {
    throw new Error("Artwork start index must be a non-negative integer.");
  }
  if (!Number.isInteger(spanSlots) || spanSlots < 1 || spanSlots > 10) {
    throw new Error("Artwork span must be an integer from 1 to 10 slots.");
  }
  if (slides.length === 0) throw new Error(`The ${device} deck has no screens.`);
  if (startIndex + spanSlots > slides.length) {
    throw new Error(
      `Artwork range ${startIndex + 1}–${startIndex + spanSlots} exceeds the ${device} deck (${slides.length} screens).`,
    );
  }
  return slides;
}

export function tonePatternForProject(
  project: ProjectState,
  device: Device,
  startIndex: number,
  spanSlots: number,
): Array<"light" | "dark"> {
  const slides = assertConnectedArtworkRange(project, device, startIndex, spanSlots);
  return slides
    .slice(startIndex, startIndex + spanSlots)
    .map((slide) => (slide.inverted ? "dark" : "light"));
}

export function upsertGeneratedArtwork(
  project: ProjectState,
  options: GeneratedArtworkOptions,
): ProjectState {
  const slides = assertConnectedArtworkRange(
    project,
    options.device,
    options.startIndex,
    options.spanSlots,
  );
  const artworkId = options.artworkId?.trim() || `ai-background-${options.startIndex + 1}-${options.spanSlots}`;
  const assetRef = options.assetRef?.trim() || `image:${artworkId}`;
  const nextSlides = slides.map((slide) => {
    const remaining = (slide.connectedArtworks || []).filter((artwork) => artwork.id !== artworkId);
    return {
      ...slide,
      connectedArtworks: remaining.length > 0 ? remaining : undefined,
    };
  });
  const artwork = {
    ...createConnectedArtwork(
      options.device,
      project.orientation,
      artworkId,
      options.image,
      options.spanSlots,
    ),
    assetRef,
  };
  nextSlides[options.startIndex] = {
    ...nextSlides[options.startIndex],
    connectedArtworks: [
      ...(nextSlides[options.startIndex].connectedArtworks || []),
      artwork,
    ],
  };

  return {
    ...project,
    slidesByDevice: {
      ...project.slidesByDevice,
      [options.device]: nextSlides,
    },
  };
}

/**
 * Apply the same reversible canvas deletion semantics from the editor to an
 * agent request. User-created layers are removed; layout-owned layers are
 * hidden so an agent cannot accidentally make a slide impossible to restore.
 */
export function removeAgentElement(
  project: ProjectState,
  options: RemoveElementOptions,
) {
  const slides = project.slidesByDevice[options.device] || [];
  if (slides.length === 0) throw new Error(`The ${options.device} deck has no screens.`);
  if (options.screenIndex !== undefined && (
    !Number.isInteger(options.screenIndex)
    || options.screenIndex < 0
    || options.screenIndex >= slides.length
  )) {
    throw new Error(`screenIndex must be an integer from 0 to ${slides.length - 1}.`);
  }

  const indexes = options.screenIndex === undefined
    ? slides.map((_, index) => index)
    : [options.screenIndex];
  for (const index of indexes) {
    const mutation = removeElementFromSlide(slides[index], options.elementId);
    if (!mutation.changed || !mutation.removed) continue;
    const nextSlides = slides.map((slide, slideIndex) => slideIndex === index ? mutation.slide : slide);
    const state: ProjectState = {
      ...project,
      slidesByDevice: {
        ...project.slidesByDevice,
        [options.device]: nextSlides,
      },
    };
    return {
      state,
      action: mutation.action,
      screenIndex: index,
      removed: mutation.removed,
    };
  }

  throw new Error(`Element ${options.elementId} was not found in the ${options.device} deck.`);
}

export function replaceArtworkImage(
  project: ProjectState,
  artworkId: string,
  fromImage: string,
  toImage: string,
): ProjectState {
  return {
    ...project,
    slidesByDevice: Object.fromEntries(
      Object.entries(project.slidesByDevice).map(([device, slides]) => [
        device,
        slides.map((slide) => ({
          ...slide,
          connectedArtworks: slide.connectedArtworks?.map((artwork) =>
            artwork.id === artworkId && artwork.image === fromImage
              ? { ...artwork, image: toImage }
              : artwork,
          ),
        })),
      ]),
    ) as ProjectState["slidesByDevice"],
  };
}

export function summarizeProject(project: ProjectState) {
  const decks = Object.fromEntries(
    Object.entries(project.slidesByDevice).map(([device, slides]) => [
      device,
      {
        screens: slides.length,
        connectedArtworks: slides.flatMap((slide, index) =>
          (slide.connectedArtworks || []).map((artwork) => ({
            id: artwork.id,
            startSlot: index + 1,
            spanSlots: artwork.spanSlots,
            image: artwork.image,
          })),
        ),
      },
    ]),
  );
  const canvas = getCanvas(project.device, project.orientation);
  return {
    appName: project.appName,
    templateId: project.templateId,
    paletteId: project.paletteId,
    themeId: project.themeId,
    connectedCanvas: project.connectedCanvas,
    device: project.device,
    orientation: project.orientation,
    locale: project.locale,
    locales: project.locales,
    canvas,
    decks,
  };
}

export type EditScreenOptions = {
  device: Device;
  /** Zero-based screen index in the device deck. */
  screenIndex: number;
  /** Locale to write copy/screenshot paths for; defaults to the project locale. */
  locale?: string;
  headline?: string;
  label?: string;
  layout?: string;
  /** Public path of the primary screenshot (already copied under /screenshots/uploaded). */
  screenshot?: string;
  screenshotSecondary?: string;
};

function assertLocale(project: ProjectState, locale: string) {
  if (!project.locales.includes(locale)) {
    throw new Error(`Unknown locale: ${locale}. Project locales: ${project.locales.join(", ")}.`);
  }
}

/**
 * Edit one screen the way the inspector does: localized copy (honouring
 * copySync linking), layout changes (which reset manual transforms), and
 * screenshot swaps (which also update the semantic asset library).
 */
export function editAgentScreen(project: ProjectState, options: EditScreenOptions) {
  const slides = project.slidesByDevice[options.device] || [];
  if (slides.length === 0) throw new Error(`The ${options.device} deck has no screens.`);
  const { screenIndex } = options;
  if (!Number.isInteger(screenIndex) || screenIndex < 0 || screenIndex >= slides.length) {
    throw new Error(`screen must be an integer from 1 to ${slides.length}.`);
  }
  const locale = options.locale ?? project.locale;
  assertLocale(project, locale);
  if (
    options.headline === undefined && options.label === undefined && options.layout === undefined
    && options.screenshot === undefined && options.screenshotSecondary === undefined
  ) {
    throw new Error("Nothing to change: pass headline, label, layout, screenshot or screenshotSecondary.");
  }
  if (options.layout !== undefined) {
    if (!AGENT_LAYOUTS.includes(options.layout as SlideLayout)) {
      throw new Error(`Unknown layout: ${options.layout}. Valid layouts: ${AGENT_LAYOUTS.join(", ")}.`);
    }
    if (options.device === "feature-graphic" && options.layout !== "feature-graphic") {
      throw new Error("The feature-graphic deck only supports the feature-graphic layout.");
    }
  }

  const changes: string[] = [];
  let next = project;
  const slideId = slides[screenIndex].id;
  if (options.headline !== undefined) {
    next = writeLinkedCopy(next, options.device, slideId, "headline", locale, options.headline);
    changes.push("headline");
  }
  if (options.label !== undefined) {
    next = writeLinkedCopy(next, options.device, slideId, "label", locale, options.label);
    changes.push("label");
  }

  const current = next.slidesByDevice[options.device][screenIndex];
  let slide: Slide = current;
  if (options.layout !== undefined) {
    const layout = options.layout as SlideLayout;
    slide = {
      ...slide,
      layout,
      transforms: undefined,
      screenshotSecondary: layout === "two-devices" ? slide.screenshotSecondary || slide.screenshot : undefined,
    };
    changes.push("layout");
  }
  let assets = next.assets;
  if (options.screenshot !== undefined) {
    slide = { ...slide, screenshot: options.screenshot };
    if (slide.assetRef) assets = replaceAssetPath(assets, slide.assetRef, locale, options.screenshot);
    changes.push("screenshot");
  }
  if (options.screenshotSecondary !== undefined) {
    if (slide.layout !== "two-devices") {
      throw new Error(`secondary screenshot needs the two-devices layout (screen is ${slide.layout}); also pass layout two-devices.`);
    }
    slide = { ...slide, screenshotSecondary: options.screenshotSecondary };
    const ref = slide.assetRefSecondary || slide.assetRef;
    if (ref) assets = replaceAssetPath(assets, ref, locale, options.screenshotSecondary);
    changes.push("secondaryScreenshot");
  }

  const state: ProjectState = {
    ...next,
    ...(assets ? { assets } : {}),
    slidesByDevice: {
      ...next.slidesByDevice,
      [options.device]: next.slidesByDevice[options.device].map((candidate, index) =>
        index === screenIndex ? slide : candidate,
      ),
    },
  };
  return { state, screenIndex, locale, changes };
}

export type SetProjectOptions = {
  device?: Device;
  orientation?: Orientation;
  locale?: string;
  appName?: string;
  paletteId?: string;
  connectedCanvas?: boolean;
};

/** Project-level switches: device, orientation, locale, app name, palette, connected canvas. */
export function setAgentProject(project: ProjectState, options: SetProjectOptions) {
  const changes: string[] = [];
  let next: ProjectState = project;
  if (options.device !== undefined) {
    if (!AGENT_DEVICES.includes(options.device)) {
      throw new Error(`Unknown device: ${options.device}. Valid devices: ${AGENT_DEVICES.join(", ")}.`);
    }
    next = { ...next, device: options.device };
    changes.push("device");
  }
  if (options.orientation !== undefined) {
    if (options.orientation !== "portrait" && options.orientation !== "landscape") {
      throw new Error("orientation must be portrait or landscape.");
    }
    next = { ...next, orientation: options.orientation };
    changes.push("orientation");
  }
  if (next.orientation === "landscape" && !supportsLandscape(next.device)) {
    throw new Error(`${next.device} does not support landscape. Use portrait, or a device with landscape support (iphone, ipad, android-7, android-10).`);
  }
  if (options.locale !== undefined) {
    assertLocale(project, options.locale);
    next = { ...next, locale: options.locale };
    changes.push("locale");
  }
  if (options.appName !== undefined) {
    const appName = options.appName.trim();
    if (!appName) throw new Error("appName must not be empty.");
    next = { ...next, appName };
    changes.push("appName");
  }
  if (options.paletteId !== undefined) {
    if (!resolveAgentPalette(options.paletteId)) {
      throw new Error(`Unknown palette: ${options.paletteId}.${didYouMean(options.paletteId, PALETTE_PRESETS.map((candidate) => candidate.id))}`);
    }
    next = applyPalette(next, options.paletteId);
    changes.push("palette");
  }
  if (options.connectedCanvas !== undefined) {
    next = { ...next, connectedCanvas: options.connectedCanvas };
    changes.push("connectedCanvas");
  }
  if (changes.length === 0) {
    throw new Error("Nothing to change: pass device, orientation, locale, appName, palette or connectedCanvas.");
  }
  return { state: next, changes };
}
