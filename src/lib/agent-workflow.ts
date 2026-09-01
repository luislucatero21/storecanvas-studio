import { getCanvas } from "./canvas";
import { createConnectedArtwork } from "./connected-artwork";
import { removeElementFromSlide } from "./element-mutations";
import {
  applyCampaignTemplate,
  applyCampaignTemplateDefinition,
  applyPalette,
  campaignTemplateById,
  paletteById,
} from "./campaign-presets";
import type { Device, ElementId, ProjectState, SlotSpan } from "./types";

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
  if (!template) throw new Error(`Unknown campaign template: ${templateId}`);

  let next = project.customTemplate?.id === template.id
    ? applyCampaignTemplateDefinition(project, template, device, options)
    : applyCampaignTemplate(project, template.id, device, options);

  if (options.paletteId) {
    if (!resolveAgentPalette(options.paletteId)) {
      throw new Error(`Unknown palette: ${options.paletteId}`);
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
