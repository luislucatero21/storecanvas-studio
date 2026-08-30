"use client";

import * as React from "react";
import { Check, Layers3, Palette, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import type { CampaignTemplate, Device, PalettePreset } from "@/lib/types";
import { cn } from "@/lib/utils";

type Props = {
  device: Device;
  templateId?: string;
  paletteId?: string;
  disabled?: boolean;
  onTemplateChange: (templateId: string) => void;
  onPaletteChange: (paletteId: string) => void;
};

export function CampaignWardrobe({
  device,
  templateId,
  paletteId,
  disabled,
  onTemplateChange,
  onPaletteChange,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const activeTemplate = campaignTemplateById(templateId) || CAMPAIGN_TEMPLATES[0];
  const activePalette = paletteById(paletteId) || PALETTE_PRESETS[0];

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
            </TabsList>
            <p className="text-xs text-muted-foreground">
              Current: <span className="font-medium text-foreground">{activeTemplate.name}</span> +{" "}
              <span className="font-medium text-foreground">{activePalette.name}</span>
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
        </Tabs>
      </DialogContent>
    </Dialog>
  );
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
