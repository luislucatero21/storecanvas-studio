"use client";
import * as React from "react";
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDownToLine,
  ArrowUpToLine,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Boxes,
  ImagePlus,
  Link2,
  LockKeyhole,
  Plus,
  SlidersHorizontal,
  RotateCw,
  Trash2,
  Type,
  Unlink,
  UnlockKeyhole,
  WandSparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LAYOUT_HINT, LAYOUT_LABEL } from "@/lib/constants";
import { nid } from "@/lib/defaults";
import {
  artworkKey,
  deviceSlotKey,
  isArtworkElementId,
  isBuiltInElementId,
  isDeviceSlotElementId,
  isTextElementId,
  textElementKey,
  toArtworkElementId,
  toTextElementId,
  toDeviceSlotElementId,
} from "@/lib/elements";
import { applyDeviceAngle, createDeviceSlot, DEVICE_ANGLE_PRESETS } from "@/lib/device-presentation";
import { createConnectedArtwork, fitConnectedArtwork } from "@/lib/connected-artwork";
import { DEFAULT_IPHONE_MODEL, IPHONE_DEVICE_MODELS, iphoneModelDefinition } from "@/lib/device-models";
import { pickText, writeLocalized } from "@/lib/locale";
import { replaceAssetPath, resolveAssetPath } from "@/lib/asset-library";
import type {
  AssetLibrary,
  BuiltInElementId,
  ConnectedArtwork,
  Device,
  DeviceAnglePreset,
  DeviceModel,
  DevicePresentation,
  ElementId,
  ElementTransform,
  LayoutConstraint,
  Orientation,
  Slide,
  SlideLayout,
  TextElement,
  SlotSpan,
  Theme,
  TypographyStyle,
} from "@/lib/types";
import { SLOT_SPAN_OPTIONS } from "@/lib/types";
import { cn } from "@/lib/utils";
import { ScreenshotPicker } from "./screenshot-picker";
import { getCanvas, getElementTransform } from "./slide-canvas";
import {
  clampSizeScale,
  effectiveTypographyColor,
  FONT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  fontOptionId,
  preferredTypographyColor,
  typographyForRole,
} from "@/lib/typography";
import { normalizeHex } from "@/lib/color";
import { captionContrastForRect } from "@/lib/caption-contrast";

type Props = {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  locale: string;
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onLocalizedChange?: (key: "label" | "headline", value: string) => void;
  onSelectElement: (id: ElementId | null) => void;
  assets?: AssetLibrary;
  onAssetLibraryChange?: (assets: AssetLibrary) => void;
  maxArtworkSpan?: number;
  artworkTonePattern?: Array<"light" | "dark">;
  theme: Theme;
  connectedCanvas?: boolean;
  deckInverted?: readonly boolean[];
  activeSlideIndex?: number;
};

const ELEMENT_LABEL: Record<BuiltInElementId, string> = {
  caption: "Headline",
  device: "Device",
  deviceSecondary: "Back device",
};

export function Inspector({
  slide,
  device,
  orientation,
  locale,
  selectedElementId,
  onChange,
  onLocalizedChange,
  onSelectElement,
  assets,
  onAssetLibraryChange,
  maxArtworkSpan,
  artworkTonePattern,
  theme,
  connectedCanvas = true,
  deckInverted = [],
  activeSlideIndex = 0,
}: Props) {
  const isFeatureGraphic = device === "feature-graphic" || slide.layout === "feature-graphic";
  const isNoDevice = slide.layout === "no-device";
  const layoutValue = device === "feature-graphic" ? "feature-graphic" : slide.layout;
  const layoutOptions = Object.entries(LAYOUT_LABEL).filter(([layout]) =>
    device === "feature-graphic" ? layout === "feature-graphic" : layout !== "feature-graphic",
  );
  const localeLabel = slide.label?.[locale] ?? "";
  const localeHeadline = slide.headline?.[locale] ?? "";
  // When the active locale is empty, surface the fallback (typically en) as
  // the placeholder so the user sees what they're translating from.
  const headlineDefault = isFeatureGraphic ? "Your tagline." : "One idea\nper slide.";
  const labelPlaceholder = localeLabel ? "FEATURE 01" : pickText(slide.label, locale) || "FEATURE 01";
  const headlinePlaceholder = localeHeadline
    ? headlineDefault
    : pickText(slide.headline, locale) || headlineDefault;

  function setLocaleField(key: "label" | "headline", value: string) {
    if (onLocalizedChange) {
      onLocalizedChange(key, value);
      return;
    }
    onChange({ [key]: writeLocalized(slide[key], locale, value) } as Partial<Slide>);
  }

  function setSemanticAssetRef(refValue: string) {
    const ref = refValue.trim();
    onChange({ assetRef: ref || undefined });
  }

  function setScreenshot(path: string, secondary = false) {
    const ref = secondary ? slide.assetRefSecondary || slide.assetRef : slide.assetRef;
    onChange(secondary ? { screenshotSecondary: path } : { screenshot: path });
    if (ref && onAssetLibraryChange) {
      onAssetLibraryChange(replaceAssetPath(assets, ref, locale, path));
    }
  }

  function setCaptionSpan(span: SlotSpan) {
    const currentSpan = slide.captionSpan || 1;
    const current = getElementTransform(slide, device, orientation, "caption", locale);
    const { cW } = getCanvas(device, orientation);
    if (!current) {
      onChange({ captionSpan: span === 1 ? undefined : span });
      return;
    }
    const defaultWidthForSpan = cW * 0.84 + cW * (span - 1);
    const desiredWidth = span < currentSpan
      ? Math.min(current.width, defaultWidthForSpan)
      : current.width + (span - currentSpan) * cW;
    const availableWidth = cW * span - Math.max(0, current.x);
    const width = Math.max(cW * 0.35, Math.min(desiredWidth, availableWidth));
    const captionConstraint = { ...(slide.constraints?.caption || {}) };
    // A responsive width override otherwise wins over the user's explicit
    // screen-count choice and can make a 1× caption cross the next seam.
    delete captionConstraint.width;
    onChange({
      captionSpan: span === 1 ? undefined : span,
      transforms: {
        ...slide.transforms,
        caption: { ...current, width },
      },
      constraints: {
        ...slide.constraints,
        caption: captionConstraint,
      },
    });
  }

  React.useEffect(() => {
    if (device === "feature-graphic" && slide.layout !== "feature-graphic") {
      onChange({ layout: "feature-graphic", transforms: undefined, screenshotSecondary: undefined });
    }
  }, [device, onChange, slide.layout]);

  return (
    <div className="flex h-full flex-col">
      <div className="border-b p-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="store-panel-title text-sm font-semibold">Screen settings</h2>
          <span className="text-[10px] uppercase tracking-wide text-muted-foreground">
            editing · {locale.toUpperCase()}
          </span>
        </div>
        <p className="text-xs text-muted-foreground">{LAYOUT_HINT[layoutValue]}</p>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-3">
        <div className="space-y-1.5">
          <Label className="text-xs">Layout</Label>
          <Select
            value={layoutValue}
            onValueChange={(layout) => {
              const next = layout as SlideLayout;
              onChange({
                layout: next,
                transforms: undefined,
                screenshotSecondary:
                  next === "two-devices" ? slide.screenshotSecondary || slide.screenshot : undefined,
              });
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {layoutOptions.map(([layout, label]) => (
                <SelectItem key={layout} value={layout}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!isFeatureGraphic && (
          <div className="space-y-1.5">
            <Label className="text-xs">Label</Label>
            <Input
              value={localeLabel}
              onChange={(e) => setLocaleField("label", e.target.value)}
              placeholder={labelPlaceholder}
            />
          </div>
        )}

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between">
            <Label className="text-xs">{isFeatureGraphic ? "Tagline" : "Headline"}</Label>
            <span className="text-[10px] text-muted-foreground">newline = break</span>
          </div>
          <Textarea
            value={localeHeadline}
            onChange={(e) => setLocaleField("headline", e.target.value)}
            rows={3}
            placeholder={headlinePlaceholder}
            aria-label="Headline"
          />
          {!isFeatureGraphic ? (
            <div className="flex items-center justify-between gap-3 rounded-md bg-muted/45 px-2.5 py-2">
              <span className="text-[10px] leading-tight text-muted-foreground">
                Message width · connected canvas
              </span>
              <div className="flex gap-1">
                {([1, 2, 3] as SlotSpan[]).map((span) => (
                  <Button
                    key={span}
                    type="button"
                    variant={(slide.captionSpan || 1) === span ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 min-w-7 px-2 text-[10px]"
                    onClick={() => setCaptionSpan(span)}
                    aria-label={`Set message width to ${span} screen${span === 1 ? "" : "s"}`}
                    aria-pressed={(slide.captionSpan || 1) === span}
                  >
                    {span}×
                  </Button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        {!isFeatureGraphic && !isNoDevice && (
          <div className="space-y-1.5">
            <Label className="text-xs">
              {slide.layout === "two-devices" ? "Front device screenshot" : "Screenshot"}
            </Label>
            <ScreenshotPicker
              label="Primary"
              value={resolveAssetPath(slide.assetRef, locale, assets, slide.screenshot)}
              locale={locale}
              onChange={(v) => setScreenshot(v)}
            />
            <details className="rounded-md border bg-muted/20">
              <summary className="cursor-pointer list-none px-2.5 py-2 text-[10px] font-medium text-muted-foreground">
                Capture reference · advanced
              </summary>
              <div className="space-y-1.5 border-t p-2.5">
                <Label className="text-xs">Semantic asset ID</Label>
                <Input
                  value={slide.assetRef || ""}
                  onChange={(event) => setSemanticAssetRef(event.target.value)}
                  placeholder="capture:home-dashboard"
                  aria-label="Semantic asset ID"
                />
                <p className="text-[10px] leading-relaxed text-muted-foreground">
                  Stable refs refresh a capture without moving its composition.
                </p>
              </div>
            </details>
          </div>
        )}

        {slide.layout === "two-devices" && (
          <div className="space-y-1.5">
            <Label className="text-xs">Secondary asset ID</Label>
            <Input
              value={slide.assetRefSecondary || ""}
              onChange={(event) => onChange({ assetRefSecondary: event.target.value.trim() || undefined })}
              placeholder="capture:insights"
              aria-label="Secondary asset ID"
            />
            <Label className="text-xs">Back device screenshot</Label>
            <ScreenshotPicker
              label="Secondary (back layer)"
              value={resolveAssetPath(
                slide.assetRefSecondary || slide.assetRef,
                locale,
                assets,
                slide.screenshotSecondary || slide.screenshot,
              )}
              locale={locale}
              onChange={(v) => setScreenshot(v, true)}
            />
          </div>
        )}

        {!isFeatureGraphic ? (
              <ConnectedArtworkPanel
                slide={slide}
                device={device}
                orientation={orientation}
                maxArtworkSpan={maxArtworkSpan}
                artworkTonePattern={artworkTonePattern}
                onChange={onChange}
                onSelectElement={onSelectElement}
              />
        ) : null}

        {!isFeatureGraphic && !isNoDevice ? (
          <DeviceSlotsPanel
            slide={slide}
            device={device}
            orientation={orientation}
            locale={locale}
            assets={assets}
            onChange={onChange}
            onSelectElement={onSelectElement}
            onAssetLibraryChange={onAssetLibraryChange}
          />
        ) : null}

        {!isFeatureGraphic && (
          <ElementTransformControls
            slide={slide}
            device={device}
            orientation={orientation}
            locale={locale}
            selectedElementId={selectedElementId}
            onChange={onChange}
            onSelectElement={onSelectElement}
            theme={theme}
            connectedCanvas={connectedCanvas}
            deckInverted={deckInverted}
            activeSlideIndex={activeSlideIndex}
          />
        )}

        {isFeatureGraphic && (
          <p className="rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Shows app icon + name + tagline. Drop an icon at <span className="rounded bg-background px-1 py-0.5 font-mono text-[10px] text-foreground">/public/app-icon.svg</span> (or leave blank — the app initial will be used). Name is set in the toolbar.
          </p>
        )}
      </div>
    </div>
  );
}

function ConnectedArtworkPanel({
  slide,
  device,
  orientation,
  maxArtworkSpan = 10,
  artworkTonePattern = [],
  onChange,
  onSelectElement,
}: {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  maxArtworkSpan?: number;
  artworkTonePattern?: Array<"light" | "dark">;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
}) {
  const [apiKey, setApiKey] = React.useState("");
  const [prompt, setPrompt] = React.useState("A calm editorial sunrise ribbon with soft indigo and coral forms, generous negative space, premium wellness campaign photography direction");
  const [generatingId, setGeneratingId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const availableSpan = Math.max(1, Math.min(10, maxArtworkSpan));

  function patchArtwork(id: string, patch: Partial<ConnectedArtwork>) {
    onChange({
      connectedArtworks: (slide.connectedArtworks || []).map((artwork) =>
        artwork.id === id ? { ...artwork, ...patch } : artwork,
      ),
    });
  }

  function addArtwork() {
    const id = nid();
    const artwork = createConnectedArtwork(device, orientation, id);
    onChange({ connectedArtworks: [...(slide.connectedArtworks || []), artwork] });
    onSelectElement(toArtworkElementId(id));
  }

  async function generate(artwork: ConnectedArtwork) {
    setError(null);
    setGeneratingId(artwork.id);
    try {
      const response = await fetch("/api/ai/image", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider: "openai",
          apiKey,
          model: "gpt-image-2",
          prompt,
          spanSlots: artwork.spanSlots,
          tone: new Set(artworkTonePattern.slice(0, artwork.spanSlots)).size > 1
            ? "mixed"
            : artworkTonePattern[0] || (slide.inverted ? "dark" : "light"),
          tonePattern: artworkTonePattern.slice(0, artwork.spanSlots),
        }),
      });
      const body = await response.json() as { ok?: boolean; path?: string; error?: string };
      if (!response.ok || !body.ok || !body.path) throw new Error(body.error || "Image generation failed");
      patchArtwork(artwork.id, { image: body.path, assetRef: undefined });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Image generation failed");
    } finally {
      setGeneratingId(null);
    }
  }

  return (
    <div className="space-y-2 rounded-md bg-[hsl(var(--accent))]/[0.06] p-3 shadow-[inset_0_0_0_1px_hsl(var(--accent)/.24)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="flex items-center gap-1.5 text-xs font-semibold"><ImagePlus className="h-3.5 w-3.5" /> Connected artwork</Label>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">One AI image can span the selected screens; phones and copy stay independent.</p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[10px]" onClick={addArtwork} aria-label="Add connected artwork">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {(slide.connectedArtworks || []).map((artwork, index) => (
        <details key={artwork.id} className="rounded-md bg-background/75 px-2.5 py-2 shadow-[0_0_0_1px_hsl(var(--border)/.55)]">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium">
            <span>Seam artwork {index + 1}</span><span className="text-[10px] font-normal text-muted-foreground">{artwork.spanSlots} screens</span>
          </summary>
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Screens covered</span>
              <Select
                value={String(artwork.spanSlots)}
                onValueChange={(value) => {
                  const span = Number(value);
                  if (!SLOT_SPAN_OPTIONS.includes(span as SlotSpan)) return;
                  patchArtwork(artwork.id, fitConnectedArtwork(artwork, device, orientation, span as SlotSpan));
                }}
              >
                <SelectTrigger className="h-8 w-32 text-[10px]" aria-label={`Set connected artwork ${index + 1} span`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SLOT_SPAN_OPTIONS
                    .filter((span) => span <= availableSpan || span === artwork.spanSlots)
                    .map((span) => (
                      <SelectItem key={span} value={String(span)}>{span} screen{span === 1 ? "" : "s"}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <ScreenshotPicker label="Panorama / background" value={artwork.image} onChange={(image) => patchArtwork(artwork.id, { image, assetRef: undefined })} />
            <div className="rounded-md border border-dashed border-border/70 bg-muted/25 p-2.5">
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground"><WandSparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> Generate seam artwork</div>
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} rows={3} aria-label={`Connected artwork ${index + 1} prompt`} />
              <div className="mt-2 grid grid-cols-[110px_1fr] gap-2">
                <span className="flex h-8 items-center rounded-md border bg-muted/35 px-2 text-[10px] font-medium">OpenAI · API key</span>
                <Input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Personal API key" aria-label="Artwork OpenAI API key" className="h-8 text-xs" autoComplete="off" />
              </div>
              <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">
                ChatGPT Plus/Pro cannot authorize API usage because billing is separate. Use a temporary key from{" "}
                <a className="underline underline-offset-2 hover:text-foreground" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">OpenAI Platform</a>.
              </p>
              <div className="mt-2 flex items-center justify-between gap-2">
                <p className="text-[9px] text-muted-foreground">The key is sent per request; it is never stored. Generation covers {artwork.spanSlots} screen{artwork.spanSlots === 1 ? "" : "s"}.</p>
                <Button type="button" size="sm" className="h-7 px-2 text-[10px]" disabled={generatingId !== null || prompt.trim().length < 12 || !apiKey.trim()} onClick={() => generate(artwork)} aria-label={`Generate connected artwork ${index + 1}`}>
                  <WandSparkles className="h-3.5 w-3.5" /> {generatingId === artwork.id ? "Generating…" : "Generate"}
                </Button>
              </div>
              {error ? <p className="mt-2 text-[10px] text-destructive">{error}</p> : null}
            </div>
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => onSelectElement(toArtworkElementId(artwork.id))}>Edit crop & position</Button>
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive" onClick={() => { onChange({ connectedArtworks: (slide.connectedArtworks || []).filter((candidate) => candidate.id !== artwork.id) || undefined }); onSelectElement(null); }} aria-label={`Remove connected artwork ${index + 1}`}>Remove</Button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function DeviceSlotsPanel({
  slide,
  device,
  orientation,
  locale,
  assets,
  onChange,
  onSelectElement,
  onAssetLibraryChange,
}: {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  locale: string;
  assets?: AssetLibrary;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
  onAssetLibraryChange?: (assets: AssetLibrary) => void;
}) {
  const [slotDisclosure, setSlotDisclosure] = React.useState<Record<string, boolean>>({});

  function addSlot() {
    const slot = createDeviceSlot(slide, device, orientation, nid());
    onChange({ deviceSlots: [...(slide.deviceSlots || []), slot] });
    onSelectElement(toDeviceSlotElementId(slot.id));
  }

  return (
    <div className="space-y-2 rounded-md bg-muted/35 p-3 shadow-[inset_0_0_0_1px_hsl(var(--border)/.65)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <Label className="flex items-center gap-1.5 text-xs font-semibold">
            <Boxes className="h-3.5 w-3.5" /> Device slots
          </Label>
          <p className="mt-0.5 text-[10px] leading-relaxed text-muted-foreground">
            Reuse one capture as a stack, sequence or cross-screen rhythm.
          </p>
        </div>
        <Button type="button" variant="outline" size="sm" className="h-7 shrink-0 px-2 text-[10px]" onClick={addSlot} aria-label="Add device slot">
          <Plus className="h-3.5 w-3.5" /> Add
        </Button>
      </div>

      {(slide.deviceSlots || []).map((slot, index) => (
        <details
          key={slot.id}
          className="group rounded-md bg-background/70 px-2.5 py-2 shadow-[0_0_0_1px_hsl(var(--border)/.55)]"
          open={slotDisclosure[slot.id] ?? index === (slide.deviceSlots?.length || 0) - 1}
          onToggle={(event) => {
            const open = event.currentTarget.open;
            setSlotDisclosure((current) => current[slot.id] === open ? current : { ...current, [slot.id]: open });
          }}
        >
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 text-[11px] font-medium">
            <span>Extra device {index + 1}</span>
            <span className="text-[10px] font-normal text-muted-foreground">{slot.linkedTransforms ? `${slot.spanSlots || 2} linked` : "Independent"}</span>
          </summary>
          <div className="mt-2 space-y-2 border-t border-border/60 pt-2">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-3 rounded-md bg-muted/45 px-2.5 py-2 text-left"
              onClick={() => onChange({ deviceSlots: (slide.deviceSlots || []).map((candidate) => candidate.id === slot.id ? { ...candidate, linkedTransforms: !candidate.linkedTransforms, spanSlots: candidate.spanSlots === 1 ? 2 : candidate.spanSlots || 2 } : candidate) })}
              aria-label={`${slot.linkedTransforms ? "Unlink" : "Link"} extra device ${index + 1} transforms across screens`}
              aria-pressed={slot.linkedTransforms === true}
            >
              <span className="flex items-center gap-1.5 text-[10px] font-medium">{slot.linkedTransforms ? <Link2 className="h-3.5 w-3.5" /> : <Unlink className="h-3.5 w-3.5" />} Share transform</span>
              <span className="text-[9px] text-muted-foreground">{slot.linkedTransforms ? "Same angle + position" : "Off · safer default"}</span>
            </button>
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] text-muted-foreground">Linked copies</span>
              <div className="flex gap-1">
                {([2, 3] as SlotSpan[]).map((span) => (
                  <Button
                    key={span}
                    type="button"
                    variant={(slot.spanSlots || 1) === span ? "secondary" : "ghost"}
                    size="sm"
                    className="h-7 min-w-7 px-2 text-[10px]"
                    disabled={!slot.linkedTransforms}
                    onClick={() => onChange({
                      deviceSlots: (slide.deviceSlots || []).map((candidate) =>
                        candidate.id === slot.id ? { ...candidate, spanSlots: span } : candidate,
                      ),
                    })}
                    aria-label={`Repeat linked extra device ${index + 1} across ${span} screens`}
                    aria-pressed={(slot.spanSlots || 1) === span}
                  >
                    {span}×
                  </Button>
                ))}
              </div>
            </div>
            <Input
              value={slot.assetRef || ""}
              onChange={(event) => onChange({
                deviceSlots: (slide.deviceSlots || []).map((candidate) =>
                  candidate.id === slot.id ? { ...candidate, assetRef: event.target.value.trim() || undefined } : candidate,
                ),
              })}
              placeholder="capture:home-dashboard"
              aria-label={`Extra device ${index + 1} semantic asset ID`}
              className="h-8 text-xs"
            />
            <ScreenshotPicker
              label={`Extra device ${index + 1}`}
              value={resolveAssetPath(slot.assetRef, locale, assets, slot.screenshot)}
              locale={locale}
              onChange={(path) => {
                onChange({
                  deviceSlots: (slide.deviceSlots || []).map((candidate) =>
                    candidate.id === slot.id ? { ...candidate, screenshot: path } : candidate,
                  ),
                });
                if (slot.assetRef && onAssetLibraryChange) {
                  onAssetLibraryChange(replaceAssetPath(assets, slot.assetRef, locale, path));
                }
              }}
            />
            <div className="flex justify-between gap-2">
              <Button type="button" variant="ghost" size="sm" className="h-7 px-2 text-[10px]" onClick={() => onSelectElement(toDeviceSlotElementId(slot.id))}>
                Edit angle & position
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-[10px] text-muted-foreground hover:text-destructive"
                onClick={() => {
                  onChange({ deviceSlots: (slide.deviceSlots || []).filter((candidate) => candidate.id !== slot.id) });
                  onSelectElement(null);
                }}
                aria-label={`Remove extra device ${index + 1}`}
              >
                Remove
              </Button>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}

function ElementTransformControls({
  slide,
  device,
  orientation,
  locale,
  selectedElementId,
  onChange,
  onSelectElement,
  theme,
  connectedCanvas,
  deckInverted,
  activeSlideIndex,
}: {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  locale: string;
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
  theme: Theme;
  connectedCanvas: boolean;
  deckInverted: readonly boolean[];
  activeSlideIndex: number;
}) {
  const present: ElementId[] = ["caption"];
  if (slide.layout !== "no-device") present.push("device");
  if (slide.layout === "two-devices") present.push("deviceSecondary");
  for (const artwork of slide.connectedArtworks || []) present.push(toArtworkElementId(artwork.id));
  for (const slot of slide.deviceSlots || []) present.push(toDeviceSlotElementId(slot.id));
  for (const element of slide.textElements || []) present.push(toTextElementId(element.id));

  const transforms = slide.transforms || {};
  const [constraintScope, setConstraintScope] = React.useState<"base" | "device" | "target" | "locale">("base");
  const activeId =
    selectedElementId && present.includes(selectedElementId) ? selectedElementId : null;
  const activeTransform = activeId
    ? getElementTransform(slide, device, orientation, activeId, locale)
    : undefined;
  const activeTextElement =
    activeId && isTextElementId(activeId)
      ? slide.textElements?.find((element) => element.id === textElementKey(activeId))
      : null;
  const activeSlot = activeId && isDeviceSlotElementId(activeId)
    ? slide.deviceSlots?.find((slot) => slot.id === deviceSlotKey(activeId))
    : undefined;
  const activePresentation = activeSlot?.presentation || (
    activeId && isBuiltInElementId(activeId) && activeId !== "caption"
      ? slide.presentations?.[activeId]
      : undefined
  );
  const { cW, cH } = getCanvas(device, orientation);
  const canvasUnit = Math.min(cW, cH);

  function getTransform(id: ElementId) {
    return getElementTransform(slide, device, orientation, id, locale);
  }

  function toggleElementFlag(flag: "hiddenElements" | "lockedElements") {
    if (!activeId) return;
    const next = new Set(slide[flag] || []);
    if (next.has(activeId)) next.delete(activeId);
    else next.add(activeId);
    onChange({ [flag]: next.size ? [...next] : undefined } as Partial<Slide>);
  }

  function currentConstraint(scope: "base" | "device" | "target" | "locale") {
    if (!activeId) return undefined;
    if (scope === "base") return slide.constraints?.[activeId];
    return slide.responsive?.[activeId]?.[scope];
  }

  function updateConstraint(patch: Partial<LayoutConstraint>) {
    if (!activeId) return;
    const current = currentConstraint(constraintScope) || {};
    const next = { ...current, ...patch };
    if (constraintScope === "base") {
      onChange({ constraints: { ...(slide.constraints || {}), [activeId]: next } });
      return;
    }
    const currentResponsive = slide.responsive?.[activeId] || {};
    onChange({
      responsive: {
        ...(slide.responsive || {}),
        [activeId]: { ...currentResponsive, [constraintScope]: next },
      },
    });
  }

  function clearConstraint() {
    if (!activeId) return;
    if (constraintScope === "base") {
      const next = { ...(slide.constraints || {}) };
      delete next[activeId];
      onChange({ constraints: Object.keys(next).length ? next : undefined });
      return;
    }
    const currentResponsive = { ...(slide.responsive || {}) };
    const nextForElement = { ...(currentResponsive[activeId] || {}) };
    delete nextForElement[constraintScope];
    if (Object.keys(nextForElement).length) currentResponsive[activeId] = nextForElement;
    else delete currentResponsive[activeId];
    onChange({ responsive: Object.keys(currentResponsive).length ? currentResponsive : undefined });
  }

  function patchElement(id: ElementId, patch: Partial<ElementTransform>) {
    const cur = getTransform(id);
    if (!cur) return;
    if (isTextElementId(id)) {
      const textId = textElementKey(id);
      onChange({
        textElements: (slide.textElements || []).map((element) =>
          element.id === textId
            ? { ...element, transform: { ...element.transform, ...patch } }
            : element,
        ),
      });
      return;
    }
    if (isArtworkElementId(id)) {
      const artworkId = artworkKey(id);
      onChange({ connectedArtworks: (slide.connectedArtworks || []).map((artwork) => artwork.id === artworkId ? { ...artwork, transform: { ...artwork.transform, ...patch } } : artwork) });
      return;
    }
    if (isDeviceSlotElementId(id)) {
      const slotId = deviceSlotKey(id);
      onChange({
        deviceSlots: (slide.deviceSlots || []).map((slot) =>
          slot.id === slotId ? { ...slot, transform: { ...slot.transform, ...patch } } : slot,
        ),
      });
      return;
    }
    if (!isBuiltInElementId(id)) return;
    onChange({
      transforms: { ...transforms, [id]: { ...cur, ...patch } },
    });
  }

  function patchTextElement(id: string, patch: Partial<TextElement>) {
    onChange({
      textElements: (slide.textElements || []).map((element) =>
        element.id === id ? { ...element, ...patch } : element,
      ),
    });
  }

  function patchCaptionStyle(role: "label" | "headline", patch: Partial<NonNullable<Slide["textStyles"]>["label"]>) {
    onChange({
      textStyles: {
        ...(slide.textStyles || {}),
        [role]: { ...(slide.textStyles?.[role] || {}), ...patch },
      },
    });
  }

  function resetCaptionStyle(role: "label" | "headline") {
    const next = { ...(slide.textStyles || {}) };
    delete next[role];
    onChange({ textStyles: Object.keys(next).length ? next : undefined });
  }

  function setTextElementValue(element: TextElement, value: string) {
    patchTextElement(element.id, { text: writeLocalized(element.text, locale, value) });
  }

  function deleteTextElement(element: TextElement) {
    const nextTextElements = (slide.textElements || []).filter((item) => item.id !== element.id);
    onChange({
      textElements: nextTextElements.length > 0 ? nextTextElements : undefined,
    });
    onSelectElement(null);
  }

  function addTextElement() {
    const { cW, cH } = getCanvas(device, orientation);
    const id = nid();
    const zIndex =
      Math.max(
        5,
        ...present.map((elementId) => getTransform(elementId)?.zIndex ?? defaultZ(elementId)),
      ) + 1;
    const element: TextElement = {
      id,
      text: writeLocalized({}, locale, "New text"),
      transform: {
        x: cW * 0.18,
        y: cH * 0.42,
        width: cW * 0.64,
        height: cH * 0.12,
        rotation: 0,
        zIndex,
      },
      fontSize: Math.round(Math.min(cW, cH) * 0.065),
      fontWeight: 800,
      align: "center",
    };
    onChange({ textElements: [...(slide.textElements || []), element] });
    onSelectElement(toTextElementId(id));
  }

  function setAnglePreset(preset: Exclude<DeviceAnglePreset, "custom">) {
    if (!activeId) return;
    const next = isDeviceSlotElementId(activeId)
      ? applyDeviceAngle(slide, { slotId: deviceSlotKey(activeId) }, preset)
      : activeId === "device" || activeId === "deviceSecondary"
        ? applyDeviceAngle(slide, activeId, preset)
        : slide;
    onChange({ presentations: next.presentations, deviceSlots: next.deviceSlots });
  }

  function patchPresentation(patch: Partial<DevicePresentation>) {
    if (!activeId) return;
    const base = activePresentation || DEVICE_ANGLE_PRESETS.flat;
    const next: DevicePresentation = { ...base, ...patch, preset: "custom" };
    writeActivePresentation(next);
  }

  function setDeviceModel(deviceModel: DeviceModel) {
    const base = activePresentation || DEVICE_ANGLE_PRESETS.flat;
    writeActivePresentation({ ...base, deviceModel });
  }

  function writeActivePresentation(next: DevicePresentation) {
    if (!activeId) return;
    if (isDeviceSlotElementId(activeId)) {
      const slotId = deviceSlotKey(activeId);
      onChange({
        deviceSlots: (slide.deviceSlots || []).map((slot) =>
          slot.id === slotId ? { ...slot, presentation: next } : slot,
        ),
      });
      return;
    }
    if (activeId === "device" || activeId === "deviceSecondary") {
      onChange({ presentations: { ...(slide.presentations || {}), [activeId]: next } });
    }
  }

  // Z-order: re-rank zIndex among present elements so they remain contiguous.
  function reorder(id: ElementId, dir: "front" | "back" | "up" | "down") {
    const ranked = [...present].sort((a, b) => {
      const za = getTransform(a)?.zIndex ?? defaultZ(a);
      const zb = getTransform(b)?.zIndex ?? defaultZ(b);
      return za - zb;
    });
    const idx = ranked.indexOf(id);
    if (idx === -1) return;
    let target = idx;
    if (dir === "front") target = ranked.length - 1;
    else if (dir === "back") target = 0;
    else if (dir === "up") target = Math.min(ranked.length - 1, idx + 1);
    else if (dir === "down") target = Math.max(0, idx - 1);
    if (target === idx) return;
    ranked.splice(idx, 1);
    ranked.splice(target, 0, id);
    const nextTransforms = { ...transforms };
    const nextTextElements = (slide.textElements || []).map((element) => ({
      ...element,
      transform: { ...element.transform },
    }));
    const nextDeviceSlots = (slide.deviceSlots || []).map((slot) => ({
      ...slot,
      transform: { ...slot.transform },
    }));
    const nextArtworks = (slide.connectedArtworks || []).map((artwork) => ({ ...artwork, transform: { ...artwork.transform } }));
    ranked.forEach((eid, i) => {
      const cur = getTransform(eid);
      if (!cur) return;
      if (isTextElementId(eid)) {
        const textId = textElementKey(eid);
        const textElement = nextTextElements.find((element) => element.id === textId);
        if (textElement) textElement.transform = { ...textElement.transform, zIndex: i + 1 };
      } else if (isArtworkElementId(eid)) {
        const artwork = nextArtworks.find((candidate) => candidate.id === artworkKey(eid));
        if (artwork) artwork.transform = { ...artwork.transform, zIndex: i + 1 };
      } else if (isDeviceSlotElementId(eid)) {
        const slot = nextDeviceSlots.find((candidate) => candidate.id === deviceSlotKey(eid));
        if (slot) slot.transform = { ...slot.transform, zIndex: i + 1 };
      } else if (isBuiltInElementId(eid)) {
        nextTransforms[eid] = { ...cur, zIndex: i + 1 };
      }
    });
    onChange({ transforms: nextTransforms, textElements: nextTextElements, deviceSlots: nextDeviceSlots, connectedArtworks: nextArtworks });
  }

  return (
    <div className="space-y-3 rounded-md border bg-muted/30 p-3">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="text-xs font-semibold">Elements</Label>
          <p className="text-[11px] text-muted-foreground">
            {activeId
              ? "Fine-tune the selected element's rotation and stacking."
              : "Click an element on the canvas to fine-tune its rotation and stacking."}
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-7 shrink-0 px-2 text-xs"
          onClick={addTextElement}
        >
          <Plus className="h-3.5 w-3.5" />
          Text
        </Button>
      </div>

      {activeId ? (
        <>
          <ActiveElementPanel
            activeId={activeId}
            slide={slide}
            transform={activeTransform}
            textElement={activeTextElement || undefined}
            locale={locale}
            onRotate={(rotation) => patchElement(activeId, { rotation })}
            onReorder={(dir) => reorder(activeId, dir)}
            onTextChange={(value) => {
              if (activeTextElement) setTextElementValue(activeTextElement, value);
            }}
            onTextPatch={(patch) => {
              if (activeTextElement) patchTextElement(activeTextElement.id, patch);
            }}
            captionStyles={slide.textStyles}
            theme={theme}
            canvasUnit={canvasUnit}
            inverted={!!slide.inverted}
            connectedCanvas={connectedCanvas}
            deckInverted={deckInverted}
            activeSlideIndex={activeSlideIndex}
            onCaptionStylePatch={patchCaptionStyle}
            onCaptionStyleReset={resetCaptionStyle}
            onDeleteText={() => {
              if (activeTextElement) deleteTextElement(activeTextElement);
            }}
            presentation={activePresentation}
            device={device}
            orientation={orientation}
            isDevice={activeId === "device" || activeId === "deviceSecondary" || isDeviceSlotElementId(activeId)}
            onAnglePreset={setAnglePreset}
            onDeviceModelChange={setDeviceModel}
            onPresentationChange={patchPresentation}
            hidden={slide.hiddenElements?.includes(activeId) ?? false}
            locked={slide.lockedElements?.includes(activeId) ?? false}
            onToggleHidden={() => toggleElementFlag("hiddenElements")}
            onToggleLocked={() => toggleElementFlag("lockedElements")}
          />
          <ResponsiveControls
            scope={constraintScope}
            constraint={currentConstraint(constraintScope)}
            onScopeChange={setConstraintScope}
            onChange={updateConstraint}
            onClear={clearConstraint}
          />
        </>
      ) : (
        <div className="rounded border border-dashed bg-background/40 p-4 text-center text-[11px] text-muted-foreground">
          No element selected
        </div>
      )}
    </div>
  );
}

function ResponsiveControls({
  scope,
  constraint,
  onScopeChange,
  onChange,
  onClear,
}: {
  scope: "base" | "device" | "target" | "locale";
  constraint?: LayoutConstraint;
  onScopeChange: (scope: "base" | "device" | "target" | "locale") => void;
  onChange: (patch: Partial<LayoutConstraint>) => void;
  onClear: () => void;
}) {
  const width = constraint?.width;
  const widthValue = width?.unit === "percent" ? Math.round(width.value * 100) : width?.value || "";
  const anchor = constraint?.x?.anchor || "center";
  return (
    <div className="space-y-2 rounded border bg-background/60 p-2.5">
      <div className="flex items-start justify-between gap-2">
        <div>
          <Label className="flex items-center gap-1 text-xs font-semibold">
            <SlidersHorizontal className="h-3.5 w-3.5" /> Responsive placement
          </Label>
          <p className="text-[10px] leading-relaxed text-muted-foreground">
            Keep this element anchored as export sizes change.
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" className="h-6 px-1.5 text-[10px]" onClick={onClear}>
          Clear
        </Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Scope</Label>
          <Select value={scope} onValueChange={(value) => onScopeChange(value as typeof scope)}>
            <SelectTrigger aria-label="Constraint scope" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="base">Base</SelectItem>
              <SelectItem value="device">Device</SelectItem>
              <SelectItem value="target">Target size</SelectItem>
              <SelectItem value="locale">Locale</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[10px] text-muted-foreground">Horizontal anchor</Label>
          <Select
            value={anchor}
            onValueChange={(value) =>
              onChange({ x: { ...(constraint?.x || {}), anchor: value as "start" | "center" | "end", value: 0, unit: "px" } })
            }
          >
            <SelectTrigger aria-label="Horizontal anchor" className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="start">Left</SelectItem>
              <SelectItem value="center">Center</SelectItem>
              <SelectItem value="end">Right</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="space-y-1">
        <Label className="text-[10px] text-muted-foreground">Width (% of artboard)</Label>
        <Input
          type="number"
          min={10}
          max={100}
          placeholder="Auto"
          value={widthValue}
          onChange={(event) => {
            const value = Number(event.target.value);
            onChange({ width: value > 0 ? { unit: "percent", value: Math.min(100, value) / 100 } : undefined });
          }}
        />
      </div>
      <p className="text-[10px] text-muted-foreground">
        Overrides resolve base → device → target → locale for the selected element.
      </p>
    </div>
  );
}

function ActiveElementPanel({
  activeId,
  slide,
  transform,
  textElement,
  locale,
  onRotate,
  onReorder,
  onTextChange,
  onTextPatch,
  captionStyles,
  theme,
  canvasUnit,
  inverted,
  connectedCanvas,
  deckInverted,
  activeSlideIndex,
  onCaptionStylePatch,
  onCaptionStyleReset,
  onDeleteText,
  hidden,
  locked,
  onToggleHidden,
  onToggleLocked,
  presentation,
  device,
  orientation,
  isDevice,
  onAnglePreset,
  onDeviceModelChange,
  onPresentationChange,
}: {
  activeId: ElementId;
  slide: Slide;
  transform: ElementTransform | undefined;
  textElement?: TextElement;
  locale: string;
  onRotate: (rotation: number) => void;
  onReorder: (dir: "front" | "back" | "up" | "down") => void;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
  captionStyles?: Slide["textStyles"];
  theme: Theme;
  canvasUnit: number;
  inverted: boolean;
  connectedCanvas: boolean;
  deckInverted: readonly boolean[];
  activeSlideIndex: number;
  onCaptionStylePatch: (role: "label" | "headline", patch: Partial<TypographyStyle>) => void;
  onCaptionStyleReset: (role: "label" | "headline") => void;
  onDeleteText: () => void;
  hidden: boolean;
  locked: boolean;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
  presentation?: DevicePresentation;
  device: Device;
  orientation: Orientation;
  isDevice: boolean;
  onAnglePreset: (preset: Exclude<DeviceAnglePreset, "custom">) => void;
  onDeviceModelChange: (model: DeviceModel) => void;
  onPresentationChange: (patch: Partial<DevicePresentation>) => void;
}) {
  const engaged = !!transform;
  const rotation = transform?.rotation ?? 0;
  const label = elementLabel(activeId);
  return (
    <div className="space-y-2 rounded border bg-background/60 p-2.5">
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium">
          {textElement && <Type className="h-3.5 w-3.5" />}
          {label}
        </span>
        <div className="flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleHidden}
            title={hidden ? "Show element" : "Hide element"}
            aria-label={hidden ? "Show element" : "Hide element"}
            aria-pressed={hidden}
          >
            {hidden ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={onToggleLocked}
            title={locked ? "Unlock element" : "Lock element"}
            aria-label={locked ? "Unlock element" : "Lock element"}
            aria-pressed={locked}
          >
            {locked ? <LockKeyhole className="h-3.5 w-3.5" /> : <UnlockKeyhole className="h-3.5 w-3.5" />}
          </Button>
          {textElement ? (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 hover:text-destructive"
              onClick={onDeleteText}
              title="Delete text element"
              aria-label="Delete text element"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          ) : !engaged ? (
            <span className="ml-1 text-[10px] text-muted-foreground">drag to enable</span>
          ) : null}
        </div>
      </div>

      {isDevice ? (
        <DeviceAnglePanel
          device={device}
          presentation={presentation}
          onPreset={onAnglePreset}
          onModelChange={onDeviceModelChange}
          onChange={onPresentationChange}
        />
      ) : null}

      {textElement && (
        <TextElementPanel
          element={textElement}
          locale={locale}
          theme={theme}
          canvasUnit={canvasUnit}
          inverted={inverted}
          onTextChange={onTextChange}
          onTextPatch={onTextPatch}
        />
      )}

      {activeId === "caption" ? (
        <CaptionTypographyPanel
          styles={captionStyles}
          theme={theme}
          slide={slide}
          device={device}
          orientation={orientation}
          connectedCanvas={connectedCanvas}
          deckInverted={deckInverted}
          activeSlideIndex={activeSlideIndex}
          canvasUnit={canvasUnit}
          onPatch={onCaptionStylePatch}
          onReset={onCaptionStyleReset}
        />
      ) : null}

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <RotateCw className="h-3 w-3" /> Rotation
          </Label>
          <span className="text-[11px] tabular-nums text-muted-foreground">
            {rotation}°
          </span>
        </div>
        <input
          type="range"
          min={-180}
          max={180}
          step={1}
          value={rotation}
          disabled={!engaged}
          onChange={(e) => onRotate(Number(e.target.value))}
          className="w-full disabled:opacity-50"
          aria-label={`${label} rotation`}
        />
      </div>

      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Layer</Label>
        <div className="grid grid-cols-4 gap-1">
          <LayerButton disabled={!engaged} onClick={() => onReorder("back")} label="Send to back">
            <ArrowDownToLine className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("down")} label="Send backward">
            <ChevronDown className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("up")} label="Bring forward">
            <ChevronUp className="h-3.5 w-3.5" />
          </LayerButton>
          <LayerButton disabled={!engaged} onClick={() => onReorder("front")} label="Bring to front">
            <ArrowUpToLine className="h-3.5 w-3.5" />
          </LayerButton>
        </div>
      </div>
    </div>
  );
}

const ANGLE_CHOICES: Array<{
  preset: Exclude<DeviceAnglePreset, "custom">;
  label: string;
  short: string;
}> = [
  { preset: "flat", label: "Flat", short: "0°" },
  { preset: "tilt-left", label: "Left tilt", short: "↙" },
  { preset: "tilt-right", label: "Right tilt", short: "↘" },
  { preset: "low-angle", label: "Low angle", short: "↑" },
  { preset: "high-angle", label: "High angle", short: "↓" },
];

function DeviceAnglePanel({
  device,
  presentation,
  onPreset,
  onModelChange,
  onChange,
}: {
  device: Device;
  presentation?: DevicePresentation;
  onPreset: (preset: Exclude<DeviceAnglePreset, "custom">) => void;
  onModelChange: (model: DeviceModel) => void;
  onChange: (patch: Partial<DevicePresentation>) => void;
}) {
  const active = presentation || DEVICE_ANGLE_PRESETS.flat;
  const activeModel = iphoneModelDefinition(active.deviceModel || DEFAULT_IPHONE_MODEL);
  return (
    <div className="space-y-2 rounded-md bg-muted/35 p-2.5 shadow-[inset_0_0_0_1px_hsl(var(--border)/.6)]">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-semibold">Camera angle</Label>
        <span className="text-[9px] uppercase tracking-[0.12em] text-muted-foreground">3D rig</span>
      </div>
      {device === "iphone" ? (
        <div className="rounded-md bg-background/70 p-2 shadow-[0_0_0_1px_hsl(var(--border)/.55)]">
          <div className="mb-1 flex items-center justify-between gap-2">
            <Label className="text-[10px] font-medium text-muted-foreground">Hardware</Label>
            <span className="text-[9px] uppercase tracking-[0.1em] text-muted-foreground">physical frame</span>
          </div>
          <Select value={activeModel.id} onValueChange={(value) => onModelChange(value as DeviceModel)}>
            <SelectTrigger aria-label="Device model" className="h-8 bg-background text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {IPHONE_DEVICE_MODELS.map((model) => (
                <SelectItem key={model.id} value={model.id}>{model.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-1.5 text-[9px] leading-relaxed text-muted-foreground">{activeModel.detail}</p>
        </div>
      ) : null}
      <div className="grid grid-cols-5 gap-1">
        {ANGLE_CHOICES.map((choice) => (
          <button
            key={choice.preset}
            type="button"
            onClick={() => onPreset(choice.preset)}
            aria-label={`Apply ${choice.label.toLowerCase()} angle`}
            aria-pressed={active.preset === choice.preset}
            title={choice.label}
            className={`flex h-11 flex-col items-center justify-center rounded-md text-[9px] outline-none transition-[background-color,color,transform] duration-150 active:scale-[.97] focus-visible:ring-2 focus-visible:ring-ring ${
              active.preset === choice.preset
                ? "bg-foreground text-background"
                : "bg-background/70 text-muted-foreground hover:bg-background hover:text-foreground"
            }`}
          >
            <span className="text-sm leading-none">{choice.short}</span>
            <span className="mt-1 truncate">{choice.label.split(" ")[0]}</span>
          </button>
        ))}
      </div>
      <details>
        <summary className="cursor-pointer text-[10px] font-medium text-muted-foreground hover:text-foreground">
          Fine tune perspective
        </summary>
        <div className="mt-2 space-y-2">
          <RigRange label="Vertical tilt" value={active.rotateX} min={-45} max={45} suffix="°" onChange={(rotateX) => onChange({ rotateX })} />
          <RigRange label="Side angle" value={active.rotateY} min={-60} max={60} suffix="°" onChange={(rotateY) => onChange({ rotateY })} />
          <RigRange label="Device depth" value={active.depth} min={0} max={48} suffix="px" onChange={(depth) => onChange({ depth })} />
          <RigRange label="Perspective" value={active.perspective} min={400} max={4000} step={50} suffix="px" onChange={(perspective) => onChange({ perspective })} />
        </div>
      </details>
    </div>
  );
}

function RigRange({
  label,
  value,
  min,
  max,
  step = 1,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  suffix: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-1 flex items-center justify-between text-[9px] text-muted-foreground">
        <span>{label}</span><span className="tabular-nums">{value}{suffix}</span>
      </span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full" aria-label={label} />
    </label>
  );
}

function TextElementPanel({
  element,
  locale,
  theme,
  canvasUnit,
  inverted,
  onTextChange,
  onTextPatch,
}: {
  element: TextElement;
  locale: string;
  theme: Theme;
  canvasUnit: number;
  inverted: boolean;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
}) {
  const text = element.text?.[locale] ?? pickText(element.text, locale);
  const textDefaults = typographyForRole(theme.typography, "text");
  const fontId = fontOptionId(element.fontFamily || textDefaults.family, "dm-sans");
  const fallbackSize = canvasUnit * 0.06 * clampSizeScale(textDefaults.sizeScale);
  const fontWeight = element.fontWeight ?? textDefaults.weight ?? 700;
  const fontStyle = element.fontStyle ?? textDefaults.style ?? "normal";
  const textDecoration = element.textDecoration ?? textDefaults.decoration ?? "none";
  const adaptiveColor = element.adaptiveColor !== false;
  const preferredColor = preferredTypographyColor("text", { color: element.color }, theme, inverted);
  const renderedColor = effectiveTypographyColor(
    "text",
    { color: element.color, adaptiveColor },
    theme,
    inverted,
  );
  return (
    <div className="space-y-2 rounded border bg-muted/30 p-2" aria-label="Text styling">
      <div className="space-y-1">
        <Label className="text-[11px] text-muted-foreground">Text</Label>
        <Textarea
          value={text}
          rows={2}
          onChange={(event) => onTextChange(event.target.value)}
          placeholder="Overlay text"
        />
      </div>
      <div className="grid grid-cols-[1fr_76px] gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Size (px)</Label>
          <Input
            type="number"
            min={12}
            max={400}
            value={Math.round(element.fontSize ?? fallbackSize)}
            onChange={(event) => onTextPatch({ fontSize: Number(event.target.value) || Math.round(fallbackSize) })}
            aria-label="Text size"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Preferred color</Label>
          <Input
            type="color"
            value={normalizeHex(preferredColor, inverted ? theme.fgAlt : theme.fg)}
            className="h-9 p-1"
            onChange={(event) => onTextPatch({ color: event.target.value })}
            aria-label="Text color"
          />
        </div>
      </div>
      <ResolvedColorIndicator
        label="Text"
        preferredColor={preferredColor}
        effectiveColors={[renderedColor]}
        adaptiveColor={adaptiveColor}
      />
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Font</Label>
          <Select value={fontId} onValueChange={(value) => onTextPatch({ fontFamily: value })}>
            <SelectTrigger aria-label="Text font" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_OPTIONS.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Weight</Label>
          <Select value={String(fontWeight)} onValueChange={(value) => onTextPatch({ fontWeight: Number(value) })}>
            <SelectTrigger aria-label="Text weight" className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {FONT_WEIGHT_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label="Bold text"
          aria-pressed={fontWeight >= 700}
          onClick={() => onTextPatch({ fontWeight: fontWeight >= 700 ? 500 : 700 })}
          className={cn("rounded-md border px-2.5 py-1.5 text-xs", fontWeight >= 700 ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10 font-bold" : "border-border/70 text-muted-foreground hover:text-foreground")}
        >
          Bold
        </button>
        <button
          type="button"
          aria-label="Italic text"
          aria-pressed={fontStyle === "italic"}
          onClick={() => onTextPatch({ fontStyle: fontStyle === "italic" ? "normal" : "italic" })}
          className={cn("rounded-md border px-2.5 py-1.5 text-xs", fontStyle === "italic" ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10" : "border-border/70 text-muted-foreground hover:text-foreground")}
        >
          <span className="italic">Italic</span>
        </button>
        <Select value={textDecoration} onValueChange={(value) => onTextPatch({ textDecoration: value as TextElement["textDecoration"] })}>
          <SelectTrigger aria-label="Text decoration" className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No decoration</SelectItem>
            <SelectItem value="underline">Underline</SelectItem>
            <SelectItem value="line-through">Strike</SelectItem>
          </SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={adaptiveColor} onChange={(event) => onTextPatch({ adaptiveColor: event.target.checked })} aria-label="Auto contrast text" className="h-4 w-4 accent-[hsl(var(--accent))]" />
          Auto contrast
        </label>
      </div>
      <div className="grid grid-cols-3 gap-1">
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "left" })}
          label="Align left"
        >
          <AlignLeft className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "center" })}
          label="Align center"
        >
          <AlignCenter className="h-3.5 w-3.5" />
        </LayerButton>
        <LayerButton
          disabled={false}
          onClick={() => onTextPatch({ align: "right" })}
          label="Align right"
        >
          <AlignRight className="h-3.5 w-3.5" />
        </LayerButton>
      </div>
    </div>
  );
}

function ResolvedColorIndicator({
  label,
  preferredColor,
  effectiveColors,
  adaptiveColor,
}: {
  label: string;
  preferredColor: string;
  effectiveColors: readonly string[];
  adaptiveColor: boolean;
}) {
  const preferred = normalizeHex(preferredColor, "#131B2C");
  const rendered = (effectiveColors.length ? effectiveColors : [preferred]).map((color) => normalizeHex(color, preferred));
  const renderedValue = rendered.join(",");
  const changed = adaptiveColor && rendered.some((color) => color !== preferred);
  return (
    <div className="mt-2 space-y-1 rounded-md border border-dashed bg-muted/20 px-2 py-1.5">
      <div className="flex items-center justify-between gap-2 text-[9px] text-muted-foreground">
        <span>{rendered.length > 1 ? `Rendered across ${rendered.length} screens` : "Rendered on this surface"}</span>
        <span className="flex items-center gap-1.5">
          <span
            aria-label={`${label} rendered color`}
            data-typography-effective-color={renderedValue}
            data-color={renderedValue}
            className="inline-block h-3.5 w-8 rounded-sm border border-foreground/15"
            style={{ backgroundColor: rendered[0] }}
          />
          <code className="font-mono text-[9px] text-foreground/75">{rendered.join(" · ")}</code>
        </span>
      </div>
      {changed ? (
        <p className="text-[9px] leading-relaxed text-muted-foreground">
          Auto contrast changes the saved preferred color only where this surface needs it.
        </p>
      ) : null}
    </div>
  );
}

function CaptionTypographyPanel({
  styles,
  theme,
  slide,
  device,
  orientation,
  connectedCanvas,
  deckInverted,
  activeSlideIndex,
  canvasUnit,
  onPatch,
  onReset,
}: {
  styles?: Slide["textStyles"];
  theme: Theme;
  slide: Slide;
  device: Device;
  orientation: Orientation;
  connectedCanvas: boolean;
  deckInverted: readonly boolean[];
  activeSlideIndex: number;
  canvasUnit: number;
  onPatch: (role: "label" | "headline", patch: Partial<TypographyStyle>) => void;
  onReset: (role: "label" | "headline") => void;
}) {
  const { cW, cH } = getCanvas(device, orientation);
  const unit = canvasUnit || Math.min(cW, cH);
  const labelStyle = {
    ...typographyForRole(theme.typography, "label"),
    ...(styles?.label || {}),
  };
  const headlineStyle = {
    ...typographyForRole(theme.typography, "headline"),
    ...(styles?.headline || {}),
  };
  const labelPreferredColor = preferredTypographyColor("label", labelStyle, theme, !!slide.inverted);
  const labelEffectiveColor = effectiveTypographyColor("label", labelStyle, theme, !!slide.inverted);
  const headlinePreferredColor = preferredTypographyColor("headline", headlineStyle, theme, !!slide.inverted);
  const headlineAdaptive = headlineStyle.adaptiveColor !== false;
  const captionRect = getElementTransform(slide, device, orientation, "caption");
  const inversionPattern = connectedCanvas && deckInverted.length ? deckInverted : [!!slide.inverted];
  const captionX = connectedCanvas
    ? activeSlideIndex * cW + (captionRect?.x || 0)
    : captionRect?.x || 0;
  const headlineContrast = headlineAdaptive && captionRect
    ? captionContrastForRect(
        theme,
        inversionPattern,
        cW,
        captionX,
        captionRect.width,
        (_baseColor, segmentInverted) => effectiveTypographyColor(
          "headline",
          headlineStyle,
          theme,
          segmentInverted,
        ),
      )
    : undefined;
  const headlineEffectiveColors = headlineContrast?.colors?.length
    ? headlineContrast.colors
    : [effectiveTypographyColor("headline", headlineStyle, theme, !!slide.inverted)];
  return (
    <div className="space-y-2 rounded border bg-muted/30 p-2" aria-label="Caption typography">
      <div className="flex items-baseline justify-between gap-2">
        <Label className="text-[11px] font-semibold">Caption typography</Label>
        <span className="text-[9px] text-muted-foreground">this slide only</span>
      </div>
      <CaptionRoleControl
        role="label"
        label="Label / eyebrow"
        style={labelStyle}
        fallbackSize={unit * 0.028 * clampSizeScale(labelStyle.sizeScale)}
        fallbackFamily="dm-sans"
        preferredColor={labelPreferredColor}
        effectiveColors={[labelEffectiveColor]}
        onPatch={onPatch}
        onReset={onReset}
      />
      <CaptionRoleControl
        role="headline"
        label="Headline"
        style={headlineStyle}
        fallbackSize={unit * 0.092 * clampSizeScale(headlineStyle.sizeScale)}
        fallbackFamily="fraunces"
        preferredColor={headlinePreferredColor}
        effectiveColors={headlineEffectiveColors}
        onPatch={onPatch}
        onReset={onReset}
      />
      <p className="text-[10px] leading-relaxed text-muted-foreground">
        Controls show the resolved theme/template values. Preferred colors are saved; rendered colors show the exact contrast result on this surface or across connected seams.
      </p>
    </div>
  );
}

function CaptionRoleControl({
  role,
  label,
  style,
  fallbackSize,
  fallbackFamily,
  preferredColor,
  effectiveColors,
  onPatch,
  onReset,
}: {
  role: "label" | "headline";
  label: string;
  style: TypographyStyle;
  fallbackSize: number;
  fallbackFamily: string;
  preferredColor: string;
  effectiveColors: readonly string[];
  onPatch: (role: "label" | "headline", patch: Partial<TypographyStyle>) => void;
  onReset: (role: "label" | "headline") => void;
}) {
  const fontId = fontOptionId(style.family, fallbackFamily);
  const adaptiveColor = style.adaptiveColor !== false;
  const preferred = normalizeHex(preferredColor, "#131B2C");
  return (
    <div className="rounded-md bg-background/70 p-2 shadow-[0_0_0_1px_hsl(var(--border)/.55)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[10px] font-medium">{label}</span>
        <button type="button" onClick={() => onReset(role)} className="text-[9px] text-muted-foreground underline underline-offset-2 hover:text-foreground">Reset</button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Font</Label>
          <Select value={fontId} onValueChange={(value) => onPatch(role, { family: value })}>
            <SelectTrigger aria-label={`${label} font`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_OPTIONS.map((option) => <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Size (px)</Label>
          <Input
            type="number"
            min={8}
            max={800}
            value={Math.round(style.fontSize || fallbackSize)}
            onChange={(event) => onPatch(role, { fontSize: Number(event.target.value) || fallbackSize })}
            aria-label={`${label} size`}
            className="h-8 text-xs"
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Weight</Label>
          <Select value={String(style.weight || (role === "headline" ? 700 : 600))} onValueChange={(value) => onPatch(role, { weight: Number(value) })}>
            <SelectTrigger aria-label={`${label} weight`} className="h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>{FONT_WEIGHT_OPTIONS.map((option) => <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-[9px] text-muted-foreground">Preferred color</Label>
          <Input
            type="color"
            value={preferred}
            onChange={(event) => onPatch(role, { color: event.target.value.toUpperCase() })}
            aria-label={`${label} color`}
            className="h-8 p-1"
          />
        </div>
      </div>
      <ResolvedColorIndicator
        label={label}
        preferredColor={preferred}
        effectiveColors={effectiveColors}
        adaptiveColor={adaptiveColor}
      />
      <div className="mt-2 flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label} bold`}
          aria-pressed={(style.weight ?? (role === "headline" ? 700 : 600)) >= 700}
          onClick={() => onPatch(role, { weight: (style.weight ?? 500) >= 700 ? 500 : 700 })}
          className={cn("rounded-md border px-2.5 py-1.5 text-xs", (style.weight ?? (role === "headline" ? 700 : 600)) >= 700 ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10 font-bold" : "border-border/70 text-muted-foreground hover:text-foreground")}
        >
          Bold
        </button>
        <button
          type="button"
          aria-label={`${label} italic`}
          aria-pressed={style.style === "italic"}
          onClick={() => onPatch(role, { style: style.style === "italic" ? "normal" : "italic" })}
          className={cn("rounded-md border px-2.5 py-1.5 text-xs", style.style === "italic" ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10" : "border-border/70 text-muted-foreground hover:text-foreground")}
        >
          <span className="italic">Italic</span>
        </button>
        <Select value={style.decoration ?? "none"} onValueChange={(value) => onPatch(role, { decoration: value as TypographyStyle["decoration"] })}>
          <SelectTrigger aria-label={`${label} decoration`} className="h-8 w-32 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">No decoration</SelectItem>
            <SelectItem value="underline">Underline</SelectItem>
            <SelectItem value="line-through">Strike</SelectItem>
          </SelectContent>
        </Select>
        <label className="ml-auto flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <input type="checkbox" checked={adaptiveColor} onChange={(event) => onPatch(role, { adaptiveColor: event.target.checked })} aria-label={`${label} auto contrast`} className="h-4 w-4 accent-[hsl(var(--accent))]" />
          Auto contrast
        </label>
      </div>
    </div>
  );
}

function LayerButton({
  disabled,
  onClick,
  label,
  children,
}: {
  disabled: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="h-7 px-0"
      disabled={disabled}
      onClick={onClick}
      title={label}
      aria-label={label}
    >
      {children}
    </Button>
  );
}

function elementLabel(id: ElementId): string {
  if (isBuiltInElementId(id)) return ELEMENT_LABEL[id];
  if (isArtworkElementId(id)) return "Connected artwork";
  if (isDeviceSlotElementId(id)) return "Extra device";
  return "Text";
}

function defaultZ(id: ElementId): number {
  if (isArtworkElementId(id)) return 1;
  if (isTextElementId(id)) return 5;
  if (isDeviceSlotElementId(id)) return 5;
  if (id === "deviceSecondary") return 2;
  if (id === "device") return 3;
  return 4; // caption on top
}
