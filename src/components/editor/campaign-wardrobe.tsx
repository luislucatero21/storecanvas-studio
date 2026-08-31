"use client";

import * as React from "react";
import { Check, Layers3, Palette, SlidersHorizontal, Sparkles } from "lucide-react";
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
  CAMPAIGN_TEMPLATES,
  PALETTE_PRESETS,
  campaignTemplateById,
  paletteById,
} from "@/lib/campaign-presets";
import type { BrandTokens, CampaignTemplate, Device, PalettePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  device: Device;
  templateId?: string;
  paletteId?: string;
  colors?: BrandTokens["colors"];
  disabled?: boolean;
  onTemplateChange: (templateId: string) => void;
  onPaletteChange: (paletteId: string) => void;
  onCustomColorsChange: (colors: NonNullable<BrandTokens["colors"]>) => void;
};

export function CampaignWardrobe({
  device,
  templateId,
  paletteId,
  colors,
  disabled,
  onTemplateChange,
  onPaletteChange,
  onCustomColorsChange,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const activeTemplate = campaignTemplateById(templateId) || CAMPAIGN_TEMPLATES[0];
  const activePalette = paletteById(paletteId) || PALETTE_PRESETS[0];
  const activePaletteName = paletteId === "custom" ? "Custom colors" : activePalette.name;

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
            </TabsList>
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{activeTemplate.name}</span> +{" "}
              <span className="font-medium text-foreground">{activePaletteName}</span>
            </p>
          </div>

          <TabsContent value="templates" className="mt-5">
            <div className="grid gap-3 md:grid-cols-2">
              {CAMPAIGN_TEMPLATES.map((template) => (
                <TemplateChoice
                  key={template.id}
                  template={template}
                  selected={template.id === activeTemplate.id}
                  disabled={disabled}
                  onSelect={() => onTemplateChange(template.id)}
                />
              ))}
            </div>
            <p className="mt-4 rounded-md bg-muted/55 px-3 py-2 text-xs leading-relaxed text-muted-foreground">
              A template resets only built-in device and caption placement for this {device} deck.
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
              colors={{ ...activePalette.colors, ...colors }}
              disabled={disabled}
              onApply={onCustomColorsChange}
            />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
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

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    const [red, green, blue] = channels.map((channel) =>
      channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
    );
    return red * 0.2126 + green * 0.7152 + blue * 0.0722;
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}

function TemplateChoice({
  template,
  selected,
  disabled,
  onSelect,
}: {
  template: CampaignTemplate;
  selected: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  const palette = paletteById(template.recommendedPaletteId) || PALETTE_PRESETS[0];
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
