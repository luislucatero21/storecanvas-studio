import type {
  CampaignTemplate,
  Device,
  PalettePreset,
  ProjectState,
  Slide,
  SlideLayout,
} from "./types";

/**
 * Presets deliberately contain no screenshot paths or copy.  A campaign can be
 * recomposed indefinitely without asking the creator to upload its captures again.
 */
export const PALETTE_PRESETS: PalettePreset[] = [
  {
    id: "parchment-signal",
    name: "Parchment signal",
    description: "Warm paper, graphite type and one optimistic coral mark.",
    themeId: "warm-editorial",
    colors: {
      primary: "#C75C48",
      accent: "#E56750",
      surface: "#F3E9DE",
      surfaceAlt: "#2B2421",
      ink: "#2B2421",
      inkAlt: "#FFF7EF",
      muted: "#7F6A5F",
    },
  },
  {
    id: "rutmia-afterglow",
    name: "Rutmia afterglow",
    description: "Inky recovery-night with a quiet violet pulse and amber reward.",
    themeId: "dark-bold",
    colors: {
      primary: "#737CFF",
      accent: "#FFA04A",
      surface: "#191B27",
      surfaceAlt: "#F6F1E9",
      ink: "#F8F5EF",
      inkAlt: "#1B2030",
      muted: "#A7AEC3",
    },
  },
  {
    id: "tide-notes",
    name: "Tide notes",
    description: "Sea-glass restraint for calm, evidence-led product stories.",
    themeId: "ocean-fresh",
    colors: {
      primary: "#2F888D",
      accent: "#E67A5B",
      surface: "#E4F0EC",
      surfaceAlt: "#163E41",
      ink: "#173C3F",
      inkAlt: "#EAF8F4",
      muted: "#597275",
    },
  },
  {
    id: "plum-press",
    name: "Plum press",
    description: "A dense plum field with a cream headline and a small apricot spark.",
    themeId: "bloom-roast",
    colors: {
      primary: "#A25C7E",
      accent: "#F2A564",
      surface: "#32233A",
      surfaceAlt: "#F7EEE4",
      ink: "#FFF8F1",
      inkAlt: "#33243A",
      muted: "#C7B4C5",
    },
  },
];

export const CAMPAIGN_TEMPLATES: CampaignTemplate[] = [
  {
    id: "editorial-route",
    name: "Editorial route",
    eyebrow: "Balanced narrative",
    description: "A clear headline, a capture-led proof point, then a memorable closer.",
    signature: "Measured contrast with one two-screen reveal.",
    recommendedPaletteId: "parchment-signal",
    layouts: [
      "hero",
      "device-bottom",
      "device-top",
      "device-bottom",
      "two-devices",
      "device-bottom",
      "device-top",
      "device-bottom",
      "device-top",
      "no-device",
    ],
    invertedIndices: [2, 6],
  },
  {
    id: "afterglow-rhythm",
    name: "Afterglow rhythm",
    eyebrow: "Confident & kinetic",
    description: "Alternating light and dark beats for apps with momentum, routines or motion.",
    signature: "An energetic front-to-back cadence with a late reveal.",
    recommendedPaletteId: "rutmia-afterglow",
    layouts: [
      "hero",
      "device-top",
      "device-bottom",
      "two-devices",
      "device-top",
      "device-bottom",
      "device-top",
      "device-bottom",
      "two-devices",
      "no-device",
    ],
    invertedIndices: [1, 4, 6, 8],
  },
  {
    id: "proof-ledger",
    name: "Proof ledger",
    eyebrow: "Calm & credible",
    description: "A sober system that lets dense real product captures make the claim.",
    signature: "An opening promise followed by quiet, legible evidence.",
    recommendedPaletteId: "tide-notes",
    layouts: [
      "hero",
      "device-bottom",
      "device-bottom",
      "two-devices",
      "device-bottom",
      "device-top",
      "device-bottom",
      "two-devices",
      "device-bottom",
      "no-device",
    ],
    invertedIndices: [5],
  },
  {
    id: "monument-close",
    name: "Monument close",
    eyebrow: "High recall",
    description: "A bolder sequence with big pauses so the campaign has room to breathe.",
    signature: "Two typographic rests frame the product’s strongest proof.",
    recommendedPaletteId: "plum-press",
    layouts: [
      "hero",
      "device-bottom",
      "device-top",
      "no-device",
      "two-devices",
      "device-bottom",
      "device-top",
      "device-bottom",
      "two-devices",
      "no-device",
    ],
    invertedIndices: [2, 3, 6, 9],
  },
];

export function paletteById(id: string | undefined): PalettePreset | undefined {
  return PALETTE_PRESETS.find((palette) => palette.id === id);
}

export function campaignTemplateById(id: string | undefined): CampaignTemplate | undefined {
  return CAMPAIGN_TEMPLATES.find((template) => template.id === id);
}

function hasSecondaryCapture(slide: Slide) {
  return Boolean(slide.screenshotSecondary || slide.assetRefSecondary);
}

function resolveLayout(layout: SlideLayout, slide: Slide, device: Device): SlideLayout {
  if (layout === "two-devices" && !hasSecondaryCapture(slide)) return "device-bottom";
  if (layout === "split-landscape" && device !== "android-7" && device !== "android-10") {
    return "device-bottom";
  }
  if (layout === "feature-graphic" && device !== "feature-graphic") return "device-bottom";
  return layout;
}

/**
 * Recompose only the active device deck. It intentionally drops generated
 * device/caption placement rules so the new layout can do its job, while keeping
 * every capture, semantic reference, locale string, custom text layer and lock.
 */
export function applyCampaignTemplate(
  project: ProjectState,
  templateId: string,
  device: Device = project.device,
): ProjectState {
  const template = campaignTemplateById(templateId);
  if (!template) return project;

  const slides = project.slidesByDevice[device] || [];
  const recomposed = slides.map((slide, index) => {
    const { constraints: _constraints, responsive: _responsive, transforms: _transforms, ...preserved } = slide;
    const templateLayout = template.layouts[index % template.layouts.length] || "device-bottom";
    const layout = resolveLayout(templateLayout, slide, device);
    const inverted = template.invertedIndices.includes(index % template.layouts.length);
    return {
      ...preserved,
      layout,
      ...(inverted ? { inverted: true } : { inverted: undefined }),
    } as Slide;
  });

  return {
    ...project,
    templateId: template.id,
    slidesByDevice: {
      ...project.slidesByDevice,
      [device]: recomposed,
    },
  };
}

/** Apply a named color system without discarding typography, effects or radius tokens. */
export function applyPalette(project: ProjectState, paletteId: string): ProjectState {
  const palette = paletteById(paletteId);
  if (!palette) return project;

  return {
    ...project,
    paletteId: palette.id,
    themeId: palette.themeId,
    brand: {
      ...project.brand,
      colors: {
        ...project.brand?.colors,
        ...palette.colors,
      },
    },
  };
}
