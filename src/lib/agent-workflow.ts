import { getCanvas } from "./canvas";
import { createConnectedArtwork } from "./connected-artwork";
import {
  applyCampaignTemplate,
  applyCampaignTemplateDefinition,
  applyPalette,
  campaignTemplateById,
  paletteById,
} from "./campaign-presets";
import type { Device, ProjectState, SlotSpan } from "./types";

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
