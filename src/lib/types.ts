export type Device =
  | "iphone"
  | "ipad"
  | "android"
  | "android-7"
  | "android-10"
  | "feature-graphic";

export type Orientation = "portrait" | "landscape";

export type Platform = "ios" | "android";

// Layouts the editor can render. Vary across slides for visual rhythm.
export type SlideLayout =
  | "hero"             // centered device, headline above
  | "device-bottom"    // headline top, device bottom-center
  | "device-top"       // device top, headline bottom (contrast)
  | "two-devices"      // back + front phones, headline above
  | "no-device"        // big headline + decorative blob, no device
  | "split-landscape"  // landscape tablets only: caption left + device right
  | "feature-graphic"; // 1024×500 banner with icon + name + tagline

// Per-element rect in canvas pixel space. Optional rotation in degrees and zIndex.
export type ElementTransform = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
  zIndex?: number;
};

export type DeviceAnglePreset =
  | "flat"
  | "tilt-left"
  | "tilt-right"
  | "low-angle"
  | "high-angle"
  | "custom";

export type DeviceModel =
  | "iphone-17-pro-max"
  | "iphone-14-pro-max"
  | "iphone-13-pro-max";

export type DevicePresentation = {
  preset: DeviceAnglePreset;
  rotateX: number;
  rotateY: number;
  perspective: number;
  depth: number;
  deviceModel?: DeviceModel;
};

export type SlotSpan = 1 | 2 | 3;

export type DeviceSlot = {
  id: string;
  screenshot: string;
  assetRef?: string;
  transform: ElementTransform;
  presentation?: DevicePresentation;
  spanSlots?: SlotSpan;
  /** Repeat this device with one shared transform. Off by default. */
  linkedTransforms?: boolean;
  opacity?: number;
};

export type ConnectedArtwork = {
  id: string;
  image: string;
  assetRef?: string;
  transform: ElementTransform;
  spanSlots: SlotSpan;
  opacity?: number;
};

export type BuiltInElementId = "caption" | "device" | "deviceSecondary";
export type TextElementId = `text:${string}`;
export type DeviceSlotElementId = `slot:${string}`;
export type ArtworkElementId = `artwork:${string}`;
export type ElementId = BuiltInElementId | TextElementId | DeviceSlotElementId | ArtworkElementId;

export type SelectedElement = {
  slideId: string;
  elementId: ElementId;
};

// Per-locale text keyed by locale code (e.g. "en", "de"). A locale is absent
// if the user hasn't typed anything for it; renderers fall back to en (see
// lib/locale.ts). The set of locales a project targets lives on
// ProjectState.locales.
export type LocalizedText = Partial<Record<string, string>>;

export type TextElement = {
  id: string;
  text: LocalizedText;
  transform: ElementTransform;
  fontSize?: number;
  fontWeight?: number;
  color?: string;
  align?: "left" | "center" | "right";
};

export type AssetType = "screen" | "component" | "image";

export type SemanticAsset = {
  id: string;
  type: AssetType;
  label?: string;
  platform?: Platform;
  paths: Partial<Record<string, string>>;
  source?: {
    adapter?: string;
    captureId?: string;
    updatedAt?: string;
  };
};

export type AssetLibrary = Record<string, SemanticAsset>;

export type BrandTokens = {
  colors?: {
    primary?: string;
    accent?: string;
    surface?: string;
    surfaceAlt?: string;
    ink?: string;
    inkAlt?: string;
    muted?: string;
  };
  typography?: {
    display?: { family?: string; weight?: number };
    body?: { family?: string; weight?: number };
  };
  radius?: { card?: number };
  effects?: { deviceShadow?: string };
};

export type ConstraintUnit = "px" | "percent";
export type ConstraintAnchor = "start" | "center" | "end" | "top" | "bottom";

export type LayoutConstraint = {
  x?: { anchor?: ConstraintAnchor; value?: number; offset?: number; unit?: ConstraintUnit };
  y?: { anchor?: ConstraintAnchor; value?: number; offset?: number; unit?: ConstraintUnit };
  width?: { value: number; unit: ConstraintUnit };
  height?: { value: number; unit: ConstraintUnit };
  maxWidth?: number;
  maxHeight?: number;
};

export type ResponsiveOverrides = {
  platform?: LayoutConstraint;
  device?: LayoutConstraint;
  target?: LayoutConstraint;
  locale?: LayoutConstraint;
  manual?: LayoutConstraint;
};

export type Slide = {
  id: string;
  layout: SlideLayout;
  label: LocalizedText;       // tiny uppercase caption above headline, per locale
  headline: LocalizedText;    // multi-line; newlines are intentional, per locale
  screenshot: string;         // path under /screenshots/ — may contain {locale}
  screenshotSecondary?: string; // for two-devices layout — may contain {locale}
  assetRef?: string;          // semantic primary capture reference
  assetRefSecondary?: string; // semantic secondary capture reference
  deviceSlots?: DeviceSlot[];
  connectedArtworks?: ConnectedArtwork[];
  presentations?: Partial<Record<"device" | "deviceSecondary", DevicePresentation>>;
  captionSpan?: SlotSpan;
  copyKey?: string;
  inverted?: boolean;         // dark background variant
  // Per-element overrides; when present, replaces layout default placement.
  transforms?: Partial<Record<BuiltInElementId, ElementTransform>>;
  textElements?: TextElement[];
  constraints?: Partial<Record<string, LayoutConstraint>>;
  responsive?: Partial<Record<string, ResponsiveOverrides>>;
  hiddenElements?: ElementId[];
  lockedElements?: ElementId[];
};

export type ThemeId =
  | "clean-light"
  | "dark-bold"
  | "warm-editorial"
  | "ocean-fresh"
  | "bloom-roast";

export type Theme = {
  id: string;
  name: string;
  bg: string;          // primary background
  bgAlt: string;       // inverted background
  fg: string;          // text on bg
  fgAlt: string;       // text on bgAlt
  accent: string;
  muted: string;
};

export type PalettePreset = {
  id: string;
  name: string;
  description: string;
  themeId: string;
  colors: Required<NonNullable<BrandTokens["colors"]>>;
};

export type CampaignTemplate = {
  id: string;
  name: string;
  eyebrow: string;
  description: string;
  signature: string;
  recommendedPaletteId: string;
  layouts: SlideLayout[];
  invertedIndices: number[];
  connectedPairs: Array<{ startIndex: number; span: SlotSpan }>;
};

export type TemplateApplyOptions = {
  applyRecommendedPalette?: boolean;
  resetCustomizations?: boolean;
  reflowConnectedArtwork?: boolean;
};

export type CampaignSource = {
  provider: "app-store";
  appId: string;
  sourceUrl: string;
  country: string;
  appVersion?: string;
  screenshotPolicy: "reference-only" | "capture-ready";
};

export type ProjectState = {
  schemaVersion?: number;
  appName: string;
  themeId: string;
  /** Composition preset applied to the current campaign deck. */
  templateId?: string;
  /** Project-owned template created from an imported store listing. */
  customTemplate?: CampaignTemplate;
  /** Named palette that produced the brand color overrides. */
  paletteId?: string;
  /** Human-readable name for a project-owned color system. */
  customPaletteName?: string;
  /** Provenance for the latest generated campaign direction. */
  campaignSource?: CampaignSource;
  copySync?: {
    enabled: boolean;
    sourceDevice: Device;
    matchBy: "copyKey-or-index";
  };
  // v1 projects render as isolated screens until the user opts into connected crops.
  connectedCanvas: boolean;
  // Locales this project targets. Drives the toolbar dropdown and bulk export.
  // Single-locale projects ship as ["en"] and hide the locale UI.
  locales: string[];
  locale: string;
  device: Device;
  orientation: Orientation;
  // Per-device slide decks so platform switching preserves work
  slidesByDevice: Record<Device, Slide[]>;
  appIcon?: string;    // path under /public (e.g. /app-icon.svg)
  assets?: AssetLibrary;
  brand?: BrandTokens;
};
