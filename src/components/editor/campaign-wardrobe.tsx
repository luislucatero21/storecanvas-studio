"use client";

import * as React from "react";
import { Check, Layers3, Palette, SlidersHorizontal, Sparkles, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CAMPAIGN_TEMPLATES,
  PALETTE_PRESETS,
  campaignTemplateById,
  paletteById,
} from "@/lib/campaign-presets";
import { contrastRatio } from "@/lib/color";
import {
  DEFAULT_TYPOGRAPHY,
  FONT_OPTIONS,
  FONT_WEIGHT_OPTIONS,
  TYPOGRAPHY_SCALE_OPTIONS,
  fontOptionById,
  fontOptionId,
} from "@/lib/typography";
import type { AccentMode, BrandTokens, CampaignTemplate, Device, PalettePreset, TemplateApplyOptions, TypographyStyle, TypographyTokens } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  device: Device;
  templateId?: string;
  customTemplate?: CampaignTemplate;
  paletteId?: string;
  customPaletteName?: string;
  colors?: BrandTokens["colors"];
  typography?: BrandTokens["typography"];
  accentMode?: AccentMode;
  disabled?: boolean;
  onTemplateChange: (templateId: string, options?: TemplateApplyOptions) => void;
  onPaletteChange: (paletteId: string) => void;
  onCustomColorsChange: (colors: NonNullable<BrandTokens["colors"]>) => void;
  onTypographyChange: (typography: TypographyTokens) => void;
  onAccentModeChange: (mode: AccentMode) => void;
};

export function CampaignWardrobe({
  device,
  templateId,
  customTemplate,
  paletteId,
  customPaletteName,
  colors,
  typography,
  accentMode = "adaptive",
  disabled,
  onTemplateChange,
  onPaletteChange,
  onCustomColorsChange,
  onTypographyChange,
  onAccentModeChange,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [useRecommendedPalette, setUseRecommendedPalette] = React.useState(false);
  const [useTemplateTypography, setUseTemplateTypography] = React.useState(false);
  const [resetCustomizations, setResetCustomizations] = React.useState(false);
  const templates = React.useMemo(
    () => customTemplate ? [customTemplate, ...CAMPAIGN_TEMPLATES.filter((item) => item.id !== customTemplate.id)] : CAMPAIGN_TEMPLATES,
    [customTemplate],
  );
  const activeTemplate = (customTemplate?.id === templateId ? customTemplate : campaignTemplateById(templateId)) || CAMPAIGN_TEMPLATES[0];
  const activePalette = paletteById(paletteId) || PALETTE_PRESETS[0];
  const activePaletteName = paletteId === "custom" ? customPaletteName || "Custom colors" : activePalette.name;
  const tuneColors = React.useMemo(
    () => ({ ...activePalette.colors, ...colors }),
    [activePalette, colors],
  );

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 border-dashed px-2 text-xs shadow-none"
        onClick={() => setOpen(true)}
        aria-label="Campaign wardrobe"
        title="Choose a campaign template or palette"
        disabled={disabled}
      >
        <Layers3 className="h-3.5 w-3.5" />
        <span className="hidden xl:inline">Campaign</span>
        <span className="hidden max-w-24 truncate text-muted-foreground 2xl:inline">
          {activeTemplate.name}
        </span>
      </Button>

      <DialogContent className="max-h-[min(760px,calc(100vh-2rem))] max-w-4xl gap-0 overflow-y-auto border-border/70 bg-card p-0 shadow-[0_24px_70px_rgba(49,35,28,0.24)]">
        <DialogHeader className="border-b border-border/70 px-6 pb-5 pt-6 pr-14">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
            Campaign wardrobe · {device}
          </div>
          <DialogTitle className="store-panel-title text-2xl leading-none">Campaign wardrobe</DialogTitle>
          <DialogDescription className="max-w-2xl pt-1 text-pretty leading-relaxed">
            Recompose the active deck without re-uploading a thing. Captures, semantic links,
            translated copy and your custom text layers stay in place.
          </DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="templates" className="px-6 pb-6 pt-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <TabsList className="h-9 rounded-full bg-muted/70 p-1">
              <TabsTrigger value="templates" className="rounded-full px-4 text-xs">
                Templates
              </TabsTrigger>
              <TabsTrigger value="palettes" className="rounded-full px-4 text-xs">
                Palettes
              </TabsTrigger>
              <TabsTrigger value="tune" className="rounded-full px-4 text-xs">
                Tune
              </TabsTrigger>
              <TabsTrigger value="typography" className="rounded-full px-4 text-xs">
                Type
              </TabsTrigger>
            </TabsList>
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{activeTemplate.name}</span> +{" "}
              <span className="font-medium text-foreground">{activePaletteName}</span>
            </p>
          </div>

          <TabsContent value="templates" className="mt-5">
            <div className="mb-4 grid gap-2 rounded-lg border border-border/70 bg-muted/35 p-3 sm:grid-cols-2">
              <button type="button" className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs", useRecommendedPalette ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10" : "border-border/60 bg-background/55")} onClick={() => setUseRecommendedPalette((value) => !value)} aria-label="Use template recommended palette" aria-pressed={useRecommendedPalette}>
                <span><span className="block font-medium">Use recommended palette</span><span className="text-[10px] text-muted-foreground">Override current or custom colors</span></span>{useRecommendedPalette ? <Check className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
              </button>
              <button type="button" className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs", resetCustomizations ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10" : "border-border/60 bg-background/55")} onClick={() => setResetCustomizations((value) => !value)} aria-label="Reset built-in placement with template" aria-pressed={resetCustomizations}>
                <span><span className="block font-medium">Reset built-in placement</span><span className="text-[10px] text-muted-foreground">Override primary device and caption positions</span></span>{resetCustomizations ? <Check className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
              </button>
              <button type="button" className={cn("flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs", useTemplateTypography ? "border-[hsl(var(--accent))]/60 bg-[hsl(var(--accent))]/10" : "border-border/60 bg-background/55")} onClick={() => setUseTemplateTypography((value) => !value)} aria-label="Use template recommended typography" aria-pressed={useTemplateTypography}>
                <span><span className="block font-medium">Use template type direction</span><span className="text-[10px] text-muted-foreground">Override current font pairing and weights</span></span>{useTemplateTypography ? <Check className="h-4 w-4 text-[hsl(var(--accent))]" /> : null}
              </button>
              <p className="sm:col-span-2 text-[10px] leading-relaxed text-muted-foreground">Connected artwork automatically moves to this template’s designed two-screen seams. Every override above is opt-in.</p>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {templates.map((template) => (
                <TemplateChoice
                  key={template.id}
                  template={template}
                  customColors={template.id === customTemplate?.id ? colors : undefined}
                  selected={template.id === activeTemplate.id}
                  disabled={disabled}
                  onSelect={() => onTemplateChange(template.id, { applyRecommendedPalette: useRecommendedPalette, applyTemplateTypography: useTemplateTypography, resetCustomizations, reflowConnectedArtwork: true })}
                />
              ))}
            </div>
            <p className="mt-4 rounded-md bg-muted/55 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              A template changes layout rhythm and connected seams for this {device} deck. Manual placement and colors stay unless you opt in above.
              Press <kbd className="rounded border bg-background px-1 font-sans text-[10px]">⌘Z</kbd> to undo it.
            </p>
          </TabsContent>

          <TabsContent value="palettes" className="mt-5">
            <div className="grid gap-3 md:grid-cols-2">
              {PALETTE_PRESETS.map((palette) => (
                <PaletteChoice
                  key={palette.id}
                  palette={palette}
                  selected={palette.id === activePalette.id}
                  disabled={disabled}
                  onSelect={() => onPaletteChange(palette.id)}
                />
              ))}
            </div>
            <p className="mt-4 rounded-md bg-muted/55 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              A palette changes campaign color tokens only. Your capture files, layout choice,
              typography and export settings are untouched.
            </p>
          </TabsContent>

          <TabsContent value="tune" className="mt-5">
            <ColorTune
              colors={tuneColors}
              disabled={disabled}
              onApply={onCustomColorsChange}
            />
          </TabsContent>

          <TabsContent value="typography" className="mt-5">
            <TypographyTune
              typography={typography}
              accentMode={accentMode}
              disabled={disabled}
              onApply={(next, nextAccentMode) => {
                onTypographyChange(next);
                onAccentModeChange(nextAccentMode);
              }}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

type TypographyGroup = {
  key: "display" | "body";
  label: string;
  description: string;
  roles: Array<"display" | "headline" | "body" | "label" | "text">;
  fallbackFamily: string;
  fallbackColor: string;
};

const TYPOGRAPHY_GROUPS: TypographyGroup[] = [
  {
    key: "display",
    label: "Display / headlines",
    description: "The main promise, feature headlines and the app name.",
    roles: ["display", "headline"],
    fallbackFamily: "fraunces",
    fallbackColor: "#17213A",
  },
  {
    key: "body",
    label: "Body / labels",
    description: "Eyebrows, supporting copy and extra text layers.",
    roles: ["body", "label", "text"],
    fallbackFamily: "dm-sans",
    fallbackColor: "#17213A",
  },
];

function TypographyTune({
  typography,
  accentMode,
  disabled,
  onApply,
}: {
  typography?: BrandTokens["typography"];
  accentMode: AccentMode;
  disabled?: boolean;
  onApply: (typography: TypographyTokens, accentMode: AccentMode) => void;
}) {
  const [draft, setDraft] = React.useState<TypographyTokens>(() => ({
    ...DEFAULT_TYPOGRAPHY,
    ...typography,
  }));
  const [adaptiveAccent, setAdaptiveAccent] = React.useState(accentMode !== "fixed");

  React.useEffect(() => {
    setDraft({ ...DEFAULT_TYPOGRAPHY, ...typography });
    setAdaptiveAccent(accentMode !== "fixed");
  }, [accentMode, typography]);

  function groupStyle(group: TypographyGroup): TypographyStyle {
    return { ...DEFAULT_TYPOGRAPHY[group.key], ...(draft[group.key] || {}), };
  }

  function patchGroup(group: TypographyGroup, patch: Partial<TypographyStyle>) {
    setDraft((current) => {
      const next = { ...current };
      for (const role of group.roles) {
        next[role] = { ...(current[role] || {}), ...patch };
      }
      return next;
    });
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background/55">
      <div className="border-b border-border/70 p-5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
          <Type className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> Type direction
        </div>
        <h3 className="store-panel-title mt-2 text-xl">Give every message a voice</h3>
        <p className="mt-2 max-w-2xl text-xs leading-relaxed text-muted-foreground">
          Choose a bundled font pairing, scale and emphasis for the whole campaign. Select a caption or text layer in the canvas to override it individually.
        </p>
      </div>

      <div className="grid gap-4 p-5 lg:grid-cols-2">
        {TYPOGRAPHY_GROUPS.map((group) => {
          const style = groupStyle(group);
          const family = fontOptionId(style.family, group.fallbackFamily);
          const font = fontOptionById(family);
          const scale = String(style.sizeScale ?? 1);
          const weight = String(style.weight ?? (group.key === "display" ? 700 : 500));
          const adaptive = style.adaptiveColor !== false;
          return (
            <section key={group.key} className="rounded-lg border border-border/70 bg-card/60 p-4" aria-label={group.label}>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{group.label}</h4>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{group.description}</p>
                </div>
                <span
                  aria-hidden
                  className="rounded-md border border-border/70 px-2 py-1 text-lg"
                  style={{ fontFamily: font?.family, fontStyle: style.style ?? "normal", fontWeight: style.weight ?? 500 }}
                >
                  Aa
                </span>
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Font
                  <Select value={family} onValueChange={(value) => patchGroup(group, { family: value })} disabled={disabled}>
                    <SelectTrigger aria-label={`${group.key === "display" ? "Display" : "Body"} font`} className="h-9 text-xs normal-case tracking-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_OPTIONS.map((option) => (
                        <SelectItem key={option.id} value={option.id}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Scale
                  <Select value={scale} onValueChange={(value) => patchGroup(group, { sizeScale: Number(value) })} disabled={disabled}>
                    <SelectTrigger aria-label={`${group.key === "display" ? "Display" : "Body"} type scale`} className="h-9 text-xs normal-case tracking-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPOGRAPHY_SCALE_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Weight
                  <Select value={weight} onValueChange={(value) => patchGroup(group, { weight: Number(value) })} disabled={disabled}>
                    <SelectTrigger aria-label={`${group.key === "display" ? "Display" : "Body"} weight`} className="h-9 text-xs normal-case tracking-normal">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FONT_WEIGHT_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={String(option.value)}>{option.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </label>
                <label className="grid gap-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
                  Color
                  <span className="flex h-9 items-center gap-2 rounded-md border border-input px-2">
                    <input
                      type="color"
                      value={/^#[0-9a-f]{6}$/i.test(style.color || "") ? style.color! : group.fallbackColor}
                      disabled={disabled}
                      onChange={(event) => patchGroup(group, { color: event.target.value.toUpperCase() })}
                      className="h-6 w-7 cursor-pointer rounded border-0 bg-transparent p-0 disabled:cursor-not-allowed"
                      aria-label={`${group.key === "display" ? "Display" : "Body"} text color`}
                    />
                    <span className="font-mono text-[10px] normal-case tracking-normal text-foreground/70">{style.color || "Theme foreground"}</span>
                  </span>
                </label>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${group.key === "display" ? "Display" : "Body"} bold`}
                  aria-pressed={(style.weight ?? (group.key === "display" ? 700 : 500)) >= 700}
                  onClick={() => patchGroup(group, { weight: (style.weight ?? 500) >= 700 ? 500 : 700 })}
                  className={cn("rounded-md border px-2.5 py-1.5 text-xs", (style.weight ?? (group.key === "display" ? 700 : 500)) >= 700 ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10 font-bold" : "border-border/70 text-muted-foreground hover:text-foreground")}
                >
                  Bold
                </button>
                <button
                  type="button"
                  disabled={disabled}
                  aria-label={`${group.key === "display" ? "Display" : "Body"} italic`}
                  aria-pressed={style.style === "italic"}
                  onClick={() => patchGroup(group, { style: style.style === "italic" ? "normal" : "italic" })}
                  className={cn("rounded-md border px-2.5 py-1.5 text-xs transition-colors", style.style === "italic" ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/10 text-foreground" : "border-border/70 text-muted-foreground hover:text-foreground")}
                >
                  <span className="italic">Italic</span>
                </button>
                <Select value={style.decoration ?? "none"} onValueChange={(value) => patchGroup(group, { decoration: value as TypographyStyle["decoration"] })} disabled={disabled}>
                  <SelectTrigger aria-label={`${group.key === "display" ? "Display" : "Body"} decoration`} className="h-8 w-32 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">No decoration</SelectItem>
                    <SelectItem value="underline">Underline</SelectItem>
                    <SelectItem value="line-through">Strike</SelectItem>
                  </SelectContent>
                </Select>
                <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={adaptive}
                    disabled={disabled}
                    onChange={(event) => patchGroup(group, { adaptiveColor: event.target.checked })}
                    aria-label={`${group.key === "display" ? "Display" : "Body"} auto contrast`}
                    className="h-4 w-4 accent-[hsl(var(--accent))]"
                  />
                  Auto contrast
                </label>
              </div>
              <p className="mt-3 text-[10px] text-muted-foreground">
                {font?.license}{font?.sourceUrl ? <> · <a href={font.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">font source</a></> : null}
              </p>
            </section>
          );
        })}
      </div>

      <div className="flex flex-wrap items-start justify-between gap-4 border-t border-border/70 bg-muted/35 px-5 py-4">
        <label className="flex max-w-xl items-start gap-2 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={adaptiveAccent}
            disabled={disabled}
            onChange={(event) => setAdaptiveAccent(event.target.checked)}
            aria-label="Adaptive accent color"
            className="mt-0.5 h-4 w-4 accent-[hsl(var(--accent))]"
          />
          <span><span className="font-semibold text-foreground">Adaptive accent color</span><span className="block text-[11px] leading-relaxed">Recommended · keeps accent labels readable against the active light or dark surface while preserving their hue.</span></span>
        </label>
        <Button type="button" size="sm" disabled={disabled} onClick={() => onApply(draft, adaptiveAccent ? "adaptive" : "fixed")}>
          Apply typography
        </Button>
      </div>
    </div>
  );
}

const COLOR_FIELDS = [
  ["surface", "Surface"],
  ["ink", "Text"],
  ["primary", "Primary"],
  ["accent", "Accent"],
  ["surfaceAlt", "Contrast surface"],
  ["inkAlt", "Contrast text"],
] as const;

function ColorTune({
  colors,
  disabled,
  onApply,
}: {
  colors: Required<NonNullable<BrandTokens["colors"]>>;
  disabled?: boolean;
  onApply: (colors: NonNullable<BrandTokens["colors"]>) => void;
}) {
  const [draft, setDraft] = React.useState(colors);
  React.useEffect(() => setDraft(colors), [colors]);
  const valid = COLOR_FIELDS.every(([key]) => /^#[0-9a-f]{6}$/i.test(draft[key]));
  const ratio = valid ? contrastRatio(draft.surface, draft.ink) : 0;

  return (
    <div className="overflow-hidden rounded-xl border border-border/70 bg-background/55">
      <div className="grid gap-5 border-b border-border/70 p-5 md:grid-cols-[minmax(0,1fr)_220px]">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            <SlidersHorizontal className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> Quick color tune
          </div>
          <h3 className="store-panel-title mt-2 text-xl">Make the campaign yours</h3>
          <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
            Adjust six campaign tokens. Layouts, screenshots, typography and localized copy stay exactly where they are.
          </p>
        </div>
        <div
          className="relative min-h-28 overflow-hidden rounded-lg p-4"
          style={{ backgroundColor: draft.surface, color: draft.ink }}
          aria-label="Custom color preview"
        >
          <span className="text-[9px] font-bold uppercase tracking-[0.18em] opacity-65">Live swatch</span>
          <span className="store-panel-title mt-2 block text-2xl leading-none">Your headline</span>
          <span className="absolute bottom-4 right-4 h-7 w-7 rounded-full" style={{ backgroundColor: draft.accent }} />
          <span className="absolute bottom-4 left-4 h-1.5 w-20 rounded-full" style={{ backgroundColor: draft.primary }} />
        </div>
      </div>

      <div className="grid gap-x-5 gap-y-4 p-5 sm:grid-cols-2">
        {COLOR_FIELDS.map(([key, label]) => (
          <label key={key} className="grid grid-cols-[36px_1fr] items-center gap-2">
            <input
              type="color"
              value={draft[key]}
              disabled={disabled}
              onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))}
              className="h-9 w-9 cursor-pointer rounded-md border border-border bg-transparent p-1 disabled:cursor-not-allowed"
              aria-label={`${label} color picker`}
            />
            <span className="min-w-0">
              <span className="mb-1 block text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">{label}</span>
              <Input
                value={draft[key]}
                disabled={disabled}
                onChange={(event) => setDraft((current) => ({ ...current, [key]: event.target.value.toUpperCase() }))}
                aria-label={`${label} hex color`}
                spellCheck={false}
                className={cn("h-8 font-mono text-xs uppercase", !/^#[0-9a-f]{6}$/i.test(draft[key]) && "border-destructive")}
              />
            </span>
          </label>
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 bg-muted/35 px-5 py-4">
        <p className="text-xs text-muted-foreground">
          Surface contrast: <span className={cn("font-semibold", ratio >= 4.5 ? "text-emerald-700" : "text-amber-700")}>{ratio.toFixed(1)}:1</span>
          {ratio >= 4.5 ? " · AA readable" : " · increase contrast"}
        </p>
        <Button type="button" size="sm" disabled={disabled || !valid} onClick={() => onApply(draft)}>
          Apply custom colors
        </Button>
      </div>
    </div>
  );
}

function TemplateChoice({
  template,
  customColors,
  selected,
  disabled,
  onSelect,
}: {
  template: CampaignTemplate;
  customColors?: BrandTokens["colors"];
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const basePalette = paletteById(template.recommendedPaletteId) || PALETTE_PRESETS[0];
  const palette = customColors
    ? { ...basePalette, id: "custom", name: "Custom", colors: { ...basePalette.colors, ...customColors } }
    : basePalette;
  return (
    <button
      type="button"
      aria-label={`Apply template ${template.name}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "campaign-choice group relative min-h-40 overflow-hidden rounded-lg border p-4 text-left outline-none transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/[0.07] shadow-[0_8px_22px_hsl(20_25%_18%_/_0.08)]"
          : "border-border/70 bg-background/45 hover:border-[hsl(var(--accent))]/45 hover:bg-background",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
            {template.eyebrow}
          </p>
          <h3 className="store-panel-title mt-1 text-lg leading-none">{template.name}</h3>
        </div>
        {selected ? (
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : (
          <span className="h-6 w-6 rounded-full border border-border/70 bg-card" />
        )}
      </div>
      <p className="mt-2 max-w-sm text-xs leading-relaxed text-muted-foreground">{template.description}</p>
      <TemplateRhythm template={template} palette={palette} />
      <p className="mt-2 text-[11px] font-medium text-foreground/80">{template.signature}</p>
    </button>
  );
}

function TemplateRhythm({ template, palette }: { template: CampaignTemplate; palette: PalettePreset }) {
  return (
    <div className="mt-4 flex h-9 items-end gap-1" aria-hidden>
      {template.layouts.slice(0, 8).map((layout, index) => {
        const isDark = template.invertedIndices.includes(index);
        const height = layout === "hero" ? "100%" : layout === "two-devices" ? "74%" : layout === "no-device" ? "54%" : "68%";
        return (
          <span
            key={`${template.id}-${index}`}
            className="relative flex-1 overflow-hidden rounded-sm"
            style={{
              height,
              backgroundColor: isDark ? palette.colors.surfaceAlt : palette.colors.surface,
              boxShadow: `inset 0 0 0 1px ${isDark ? "rgba(255,255,255,.12)" : "rgba(36,30,26,.08)"}`,
            }}
          >
            {layout !== "no-device" && (
              <i
                className="absolute bottom-0 left-1/2 w-[44%] -translate-x-1/2 rounded-t-sm"
                style={{
                  height: layout === "device-top" ? "46%" : "67%",
                  backgroundColor: palette.colors.primary,
                  opacity: 0.78,
                }}
              />
            )}
            <i
              className="absolute left-[18%] top-[18%] h-[10%] w-[50%] rounded-full"
              style={{ backgroundColor: isDark ? palette.colors.inkAlt : palette.colors.ink, opacity: 0.72 }}
            />
          </span>
        );
      })}
    </div>
  );
}

function PaletteChoice({
  palette,
  selected,
  disabled,
  onSelect,
}: {
  palette: PalettePreset;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const swatches = [
    palette.colors.surface,
    palette.colors.surfaceAlt,
    palette.colors.primary,
    palette.colors.accent,
  ];
  return (
    <button
      type="button"
      aria-label={`Apply palette ${palette.name}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
      className={cn(
        "campaign-choice group flex min-h-32 items-stretch overflow-hidden rounded-lg border text-left outline-none transition-[border-color,background-color,transform,box-shadow] duration-150 ease-out hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50",
        selected
          ? "border-[hsl(var(--accent))]/70 bg-[hsl(var(--accent))]/[0.07] shadow-[0_8px_22px_hsl(20_25%_18%_/_0.08)]"
          : "border-border/70 bg-background/45 hover:border-[hsl(var(--accent))]/45 hover:bg-background",
      )}
    >
      <span className="grid w-[32%] min-w-24 grid-cols-2" aria-hidden>
        {swatches.map((color) => (
          <i key={color} style={{ backgroundColor: color }} />
        ))}
      </span>
      <span className="flex min-w-0 flex-1 flex-col justify-between p-4">
        <span>
          <span className="flex items-start justify-between gap-3">
            <span>
              <span className="block text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                Color system
              </span>
              <span className="store-panel-title mt-1 block text-lg leading-none">{palette.name}</span>
            </span>
            {selected ? <Check className="mt-0.5 h-4 w-4 shrink-0 text-[hsl(var(--accent))]" /> : null}
          </span>
          <span className="mt-2 block text-xs leading-relaxed text-muted-foreground">{palette.description}</span>
        </span>
        <span className="mt-3 flex items-center gap-1.5 text-[11px] font-medium text-foreground/70">
          <Palette className="h-3.5 w-3.5" /> {palette.themeId}
        </span>
      </span>
    </button>
  );
}
