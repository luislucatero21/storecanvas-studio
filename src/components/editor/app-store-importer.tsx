"use client";

import * as React from "react";
import {
  AppWindow,
  ArrowRight,
  Check,
  ExternalLink,
  Image as ImageIcon,
  Link2,
  LoaderCircle,
  Palette,
  ScanSearch,
  ShieldCheck,
  Sparkles,
  Type,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CampaignImportOptions, CampaignImportProposal } from "@/lib/app-store-import";
import { cn } from "@/lib/utils";

type Props = {
  appName: string;
  currentSourceUrl?: string;
  disabled?: boolean;
  onApply: (proposal: CampaignImportProposal, options: CampaignImportOptions) => void;
};

type ToggleKey = "applyTemplate" | "applyPalette" | "applyCopy" | "applyAppIcon" | "useStoreScreenshots";

const DEFAULT_OPTIONS: Record<ToggleKey, boolean> = {
  applyTemplate: true,
  applyPalette: true,
  applyCopy: true,
  applyAppIcon: true,
  useStoreScreenshots: false,
};

export function AppStoreImporter({ appName, currentSourceUrl, disabled, onApply }: Props) {
  const initialUrl = currentSourceUrl || "";
  const [open, setOpen] = React.useState(false);
  const [url, setUrl] = React.useState(initialUrl);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [proposal, setProposal] = React.useState<CampaignImportProposal | null>(null);
  const [options, setOptions] = React.useState(DEFAULT_OPTIONS);

  React.useEffect(() => {
    if (!open) setUrl(currentSourceUrl || "");
  }, [appName, currentSourceUrl, open]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setError(null);
      setProposal(null);
      setOptions(DEFAULT_OPTIONS);
    }
  }

  async function analyze() {
    if (!url.trim() || loading) return;
    setLoading(true);
    setError(null);
    setProposal(null);
    try {
      const response = await fetch("/api/import/app-store", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: url.trim() }),
      });
      const body = await response.json() as { ok?: boolean; error?: string; proposal?: CampaignImportProposal };
      if (!response.ok || !body.ok || !body.proposal) {
        throw new Error(body.error || "StoreCanvas could not analyze this listing.");
      }
      setProposal(body.proposal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "StoreCanvas could not analyze this listing.");
    } finally {
      setLoading(false);
    }
  }

  function toggle(key: ToggleKey) {
    setOptions((current) => ({ ...current, [key]: !current[key] }));
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => setOpen(true)}
        aria-label="Build campaign from App Store"
        title="Generate a custom campaign from an App Store URL"
        disabled={disabled}
      >
        <Link2 className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
        <span className="hidden xl:inline">Import listing</span>
      </Button>

      <DialogContent className="max-h-[min(840px,calc(100vh-2rem))] max-w-6xl gap-0 overflow-y-auto border-border/70 bg-card p-0 shadow-[0_24px_70px_rgba(49,35,28,0.24)]">
        <DialogHeader className="border-b border-border/70 px-6 pb-5 pt-6 pr-14">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <ScanSearch className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
            Storefront intelligence
          </div>
          <DialogTitle className="store-panel-title text-2xl leading-none">Build from an App Store listing</DialogTitle>
          <DialogDescription className="max-w-3xl pt-1 text-pretty leading-relaxed">
            Paste a public app URL. StoreCanvas reads Apple’s listing, icon and published screenshots,
            then drafts a project-owned template, palette and narrative for you to review.
          </DialogDescription>
        </DialogHeader>

        <div className="border-b border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <AppWindow className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                aria-label="App Store URL"
                type="url"
                value={url}
                onChange={(event) => setUrl(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void analyze();
                }}
                disabled={loading}
                className="h-10 bg-background pl-9 text-sm"
                placeholder="https://apps.apple.com/…/id123456789"
              />
            </div>
            <Button type="button" className="h-10 min-w-32" onClick={() => void analyze()} disabled={loading || !url.trim()}>
              {loading ? <LoaderCircle className="animate-spin" /> : <Sparkles />}
              {loading ? "Reading Apple…" : proposal ? "Analyze again" : "Analyze listing"}
            </Button>
          </div>
          <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
            Public metadata only. StoreCanvas queries Apple directly and caches visual references in this project.
          </p>
          {error ? <p className="mt-3 rounded-md border border-destructive/25 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</p> : null}
        </div>

        {proposal ? (
          <CampaignReview
            proposal={proposal}
            options={options}
            onToggle={toggle}
            onApply={() => {
              onApply(proposal, options);
              handleOpenChange(false);
            }}
          />
        ) : (
          <EmptyReceipt loading={loading} />
        )}
      </DialogContent>
    </Dialog>
  );
}

function EmptyReceipt({ loading }: { loading: boolean }) {
  return (
    <div className="grid min-h-80 place-items-center px-6 py-12 text-center">
      <div className="max-w-md">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-border bg-muted/35">
          {loading ? <LoaderCircle className="h-5 w-5 animate-spin text-[hsl(var(--accent))]" /> : <ScanSearch className="h-5 w-5 text-muted-foreground" />}
        </div>
        <h3 className="store-panel-title mt-4 text-xl">{loading ? "Reading the storefront" : "A campaign receipt will appear here"}</h3>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {loading
            ? "Matching the product promise to a visual rhythm and checking whether published screenshots are safe to reuse."
            : "You’ll see the source evidence, generated direction and every replacement before anything changes."}
        </p>
      </div>
    </div>
  );
}

function CampaignReview({
  proposal,
  options,
  onToggle,
  onApply,
}: {
  proposal: CampaignImportProposal;
  options: Record<ToggleKey, boolean>;
  onToggle: (key: ToggleKey) => void;
  onApply: () => void;
}) {
  const listing = proposal.listing;
  const previewImages = listing.screenshotUrls.slice(0, 5);
  return (
    <div>
      <section className="grid gap-5 border-b border-border/70 px-6 py-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="flex min-w-0 gap-4">
          {listing.localArtworkPath || listing.artworkUrl ? (
            <img
              src={listing.localArtworkPath || listing.artworkUrl}
              alt={`${listing.name} app icon`}
              className="h-16 w-16 shrink-0 rounded-[16px] border border-white/70 object-cover shadow-[0_6px_18px_rgba(35,39,53,0.16)]"
            />
          ) : (
            <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[16px] bg-muted"><AppWindow /></span>
          )}
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="store-panel-title text-2xl leading-none">{listing.name}</h3>
              <a href={listing.sourceUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground">
                App Store <ExternalLink className="h-3 w-3" />
              </a>
            </div>
            <p className="mt-2 text-sm leading-relaxed text-foreground/80">{proposal.summary}</p>
            <div className="mt-3 flex flex-wrap gap-1.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span className="rounded-full border bg-background px-2 py-1">Apple · {listing.country.toUpperCase()}</span>
              {listing.genre ? <span className="rounded-full border bg-background px-2 py-1">{listing.genre}</span> : null}
              {listing.version ? <span className="rounded-full border bg-background px-2 py-1">v{listing.version}</span> : null}
            </div>
          </div>
        </div>
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Evidence used</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {proposal.evidence.map((item) => (
              <span key={item.id} title={item.detail} className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-background/70 px-2.5 py-1.5 text-xs">
                <ShieldCheck className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> {item.label}
              </span>
            ))}
          </div>
        </div>
      </section>

      <section className="grid gap-3 px-6 py-5 lg:grid-cols-3">
        <DirectionCard icon={<AppWindow />} eyebrow="Template" title={proposal.template.name} selected={options.applyTemplate} onClick={() => onToggle("applyTemplate")}>
          <TemplateRhythm proposal={proposal} />
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{proposal.template.signature}</p>
        </DirectionCard>
        <DirectionCard icon={<Palette />} eyebrow="Palette" title={proposal.palette.name} selected={options.applyPalette} onClick={() => onToggle("applyPalette")}>
          <div className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Generated palette">
            {[proposal.palette.colors.surface, proposal.palette.colors.surfaceAlt, proposal.palette.colors.primary, proposal.palette.colors.accent].map((color) => (
              <span key={color} className="h-12 rounded-md border border-black/5" style={{ backgroundColor: color }} title={color} />
            ))}
          </div>
          <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{proposal.palette.rationale}</p>
        </DirectionCard>
        <DirectionCard icon={<Type />} eyebrow="Story" title={`${proposal.copy.length} outcome-led messages`} selected={options.applyCopy} onClick={() => onToggle("applyCopy")}>
          <div className="mt-3 space-y-2">
            {proposal.copy.slice(0, 4).map((item, index) => (
              <div key={`${item.signal}-${index}`} className="grid grid-cols-[20px_1fr] gap-2 text-xs">
                <span className="font-mono text-[10px] text-muted-foreground">{String(index + 1).padStart(2, "0")}</span>
                <span className="font-medium leading-tight">{item.headline}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[11px] text-muted-foreground">Each line remains editable after import.</p>
        </DirectionCard>
      </section>

      {previewImages.length ? (
        <section className="border-y border-border/70 bg-muted/20 px-6 py-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Published screenshot evidence</p>
              <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">{proposal.screenshotRationale}</p>
            </div>
            <button
              type="button"
              onClick={() => onToggle("useStoreScreenshots")}
              aria-pressed={options.useStoreScreenshots}
              aria-label="Use published App Store screenshots as device captures"
              className={cn(
                "inline-flex items-center gap-2 rounded-md border px-3 py-2 text-xs font-medium transition-colors",
                options.useStoreScreenshots ? "border-[hsl(var(--accent))]/55 bg-[hsl(var(--accent))]/10" : "border-border bg-background",
              )}
            >
              <ImageIcon className="h-3.5 w-3.5" /> Use as device captures
              {options.useStoreScreenshots ? <Check className="h-3.5 w-3.5 text-[hsl(var(--accent))]" /> : null}
            </button>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {previewImages.map((image, index) => (
              <img
                key={image}
                src={listing.localScreenshotPaths[index] || image}
                alt={`Published App Store screenshot ${index + 1}`}
                className="h-28 w-auto shrink-0 rounded-md border border-border/70 bg-background object-cover shadow-sm"
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="flex flex-col gap-4 px-6 py-5 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap gap-2">
          <ApplyToggle label="Custom template" active={options.applyTemplate} onClick={() => onToggle("applyTemplate")} />
          <ApplyToggle label="Brand palette" active={options.applyPalette} onClick={() => onToggle("applyPalette")} />
          <ApplyToggle label="Campaign text" active={options.applyCopy} onClick={() => onToggle("applyCopy")} />
          <ApplyToggle label="App icon" active={options.applyAppIcon} onClick={() => onToggle("applyAppIcon")} />
        </div>
        <Button type="button" className="min-w-52" onClick={onApply} disabled={!options.applyTemplate && !options.applyPalette && !options.applyCopy && !options.applyAppIcon && !options.useStoreScreenshots}>
          Apply custom campaign <ArrowRight />
        </Button>
      </section>
    </div>
  );
}

function DirectionCard({
  icon,
  eyebrow,
  title,
  selected,
  onClick,
  children,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <article className={cn("rounded-xl border p-4 transition-colors", selected ? "border-[hsl(var(--accent))]/45 bg-[hsl(var(--accent))]/[0.045]" : "border-border/70 bg-muted/15 opacity-65")}>
      <button type="button" className="flex w-full items-start justify-between gap-3 text-left" onClick={onClick} aria-pressed={selected} aria-label={`Apply generated ${eyebrow.toLowerCase()}`}>
        <span>
          <span className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">{icon} {eyebrow}</span>
          <span className="store-panel-title mt-1 block text-lg leading-tight">{title}</span>
        </span>
        <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border", selected ? "border-[hsl(var(--accent))] bg-[hsl(var(--accent))] text-[hsl(var(--accent-foreground))]" : "border-border bg-background")}>
          {selected ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
      </button>
      {children}
    </article>
  );
}

function TemplateRhythm({ proposal }: { proposal: CampaignImportProposal }) {
  const palette = proposal.palette.colors;
  return (
    <div className="mt-4 flex h-12 items-end gap-1" aria-label="Generated template rhythm">
      {proposal.template.layouts.slice(0, 10).map((layout, index) => {
        const dark = proposal.template.invertedIndices.includes(index);
        const height = layout === "hero" ? "100%" : layout === "no-device" ? "52%" : layout === "two-devices" ? "78%" : "68%";
        return (
          <span key={`${layout}-${index}`} className="relative flex-1 overflow-hidden rounded-[3px]" style={{ height, backgroundColor: dark ? palette.surfaceAlt : palette.surface }}>
            {layout !== "no-device" ? <i className="absolute bottom-0 left-1/2 h-[58%] w-[45%] -translate-x-1/2 rounded-t-sm" style={{ backgroundColor: index % 2 ? palette.accent : palette.primary, opacity: 0.8 }} /> : null}
          </span>
        );
      })}
    </div>
  );
}

function ApplyToggle({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1.5 text-xs", active ? "border-[hsl(var(--accent))]/45 bg-[hsl(var(--accent))]/10 text-foreground" : "border-border bg-background text-muted-foreground")}
      onClick={onClick}
      aria-pressed={active}
      aria-label={`Apply ${label.toLowerCase()}`}
    >
      {active ? <Check className="h-3 w-3 text-[hsl(var(--accent))]" /> : null}{label}
    </button>
  );
}
