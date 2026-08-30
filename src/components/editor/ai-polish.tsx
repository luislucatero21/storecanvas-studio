"use client";

import * as React from "react";
import { Check, KeyRound, LoaderCircle, Sparkles, WandSparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { campaignTemplateById, paletteById } from "@/lib/campaign-presets";
import { pickText } from "@/lib/locale";
import type { AiMode, AiProposal, AiProvider } from "@/lib/ai";
import type { Device, Slide } from "@/lib/types";

const DEFAULT_MODEL: Record<AiProvider, string> = {
  openai: "gpt-4.1-mini",
  openrouter: "openai/gpt-4o-mini",
  platform: "gpt-4.1-mini",
};

const PROVIDER_COPY: Record<AiProvider, { name: string; detail: string }> = {
  openai: {
    name: "OpenAI · bring your key",
    detail: "Uses the OpenAI Chat Completions API with your model choice.",
  },
  openrouter: {
    name: "OpenRouter · bring your key",
    detail: "Use a model slug from your OpenRouter account.",
  },
  platform: {
    name: "StoreCanvas workspace",
    detail: "Uses managed workspace credits when this deployment is configured.",
  },
};

type Props = {
  appName: string;
  locale: string;
  device: Device;
  slides: Slide[];
  templateId?: string;
  paletteId?: string;
  disabled?: boolean;
  onApplyProposal: (proposal: AiProposal) => void;
  onApplyTemplate: (templateId: string) => void;
  onApplyPalette: (paletteId: string) => void;
};

export function AiPolish({
  appName,
  locale,
  device,
  slides,
  templateId,
  paletteId,
  disabled,
  onApplyProposal,
  onApplyTemplate,
  onApplyPalette,
}: Props) {
  const [open, setOpen] = React.useState(false);
  const [provider, setProvider] = React.useState<AiProvider>("openai");
  const [mode, setMode] = React.useState<AiMode>("polish");
  const [model, setModel] = React.useState(DEFAULT_MODEL.openai);
  const [apiKey, setApiKey] = React.useState("");
  const [brief, setBrief] = React.useState("");
  const [proposal, setProposal] = React.useState<AiProposal | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(false);

  const campaignSlides = React.useMemo(
    () =>
      slides
        .map((slide) => ({
          id: slide.id,
          label: pickText(slide.label, locale),
          headline: pickText(slide.headline, locale),
        }))
        .filter((slide) => slide.headline.trim().length > 0),
    [locale, slides],
  );
  const originalById = React.useMemo(
    () => new Map(campaignSlides.map((slide) => [slide.id, slide])),
    [campaignSlides],
  );
  const requiresKey = provider !== "platform";
  const cannotRun = disabled || loading || campaignSlides.length === 0 || (requiresKey && !apiKey.trim());

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next) {
      setApiKey("");
      setError(null);
      setProposal(null);
    }
  }

  async function generate() {
    if (cannotRun) return;
    setLoading(true);
    setError(null);
    setProposal(null);
    try {
      const response = await fetch("/api/ai/improve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          provider,
          ...(requiresKey ? { apiKey } : {}),
          model,
          mode,
          appName,
          locale,
          templateId,
          paletteId,
          brief,
          slides: campaignSlides,
        }),
      });
      const body = (await response.json()) as { ok?: boolean; error?: string; proposal?: AiProposal };
      if (!response.ok || !body.ok || !body.proposal) {
        throw new Error(body.error || "StoreCanvas could not create suggestions.");
      }
      setProposal(body.proposal);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "StoreCanvas could not create suggestions.");
    } finally {
      setLoading(false);
    }
  }

  const suggestedTemplate = campaignTemplateById(proposal?.recommendedTemplateId);
  const suggestedPalette = paletteById(proposal?.recommendedPaletteId);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        aria-label="AI polish"
        title="Use AI to improve campaign copy"
        disabled={disabled}
        onClick={() => setOpen(true)}
      >
        <WandSparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
        <span className="hidden lg:inline">AI polish</span>
      </Button>

      <DialogContent className="max-h-[min(800px,calc(100vh-2rem))] max-w-5xl gap-0 overflow-y-auto border-border/70 bg-card p-0 shadow-[0_24px_70px_rgba(49,35,28,0.24)]">
        <DialogHeader className="border-b border-border/70 px-6 pb-5 pt-6 pr-14">
          <div className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5 text-[hsl(var(--accent))]" />
            AI review · {device} · {locale}
          </div>
          <DialogTitle className="store-panel-title text-2xl leading-none">AI polish</DialogTitle>
          <DialogDescription className="max-w-2xl pt-1 text-pretty leading-relaxed">
            Get a second editorial pass for the campaign, then choose exactly what reaches the
            canvas. StoreCanvas sends only app and copy context—never captures or asset paths.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-0 lg:grid-cols-[minmax(0,0.82fr)_minmax(0,1.18fr)]">
          <section className="border-b border-border/70 p-6 lg:border-b-0 lg:border-r">
            <div className="space-y-5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Provider</p>
                <Select
                  value={provider}
                  onValueChange={(value) => {
                    const next = value as AiProvider;
                    setProvider(next);
                    setModel(DEFAULT_MODEL[next]);
                    setError(null);
                  }}
                  disabled={loading}
                >
                  <SelectTrigger aria-label="AI provider" className="mt-2 h-10 w-full text-sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(PROVIDER_COPY) as AiProvider[]).map((value) => (
                      <SelectItem key={value} value={value}>{PROVIDER_COPY[value].name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{PROVIDER_COPY[provider].detail}</p>
              </div>

              {requiresKey ? (
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="ai-api-key">
                    Personal API key
                  </label>
                  <div className="relative mt-2">
                    <KeyRound className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <Input
                      id="ai-api-key"
                      aria-label="Personal API key"
                      type="password"
                      autoComplete="off"
                      value={apiKey}
                      onChange={(event) => setApiKey(event.target.value)}
                      disabled={loading}
                      className="h-10 pl-9 text-sm"
                      placeholder={provider === "openrouter" ? "sk-or-v1-…" : "sk-…"}
                    />
                  </div>
                  <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                    This key lives only in this dialog session and is <span className="font-medium text-foreground">never saved in StoreCanvas</span>.
                  </p>
                </div>
              ) : (
                <p className="rounded-md bg-muted/60 px-3 py-2.5 text-xs leading-relaxed text-muted-foreground">
                  No personal key is needed. A deployment administrator must configure the managed
                  workspace endpoint and credits first.
                </p>
              )}

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="ai-model">
                  Model
                </label>
                <Input
                  id="ai-model"
                  aria-label="AI model"
                  value={model}
                  onChange={(event) => setModel(event.target.value)}
                  disabled={loading}
                  className="mt-2 h-10 text-sm"
                />
              </div>

              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Pass</p>
                <Tabs value={mode} onValueChange={(value) => setMode(value as AiMode)} className="mt-2">
                  <TabsList className="h-auto w-full justify-start rounded-md bg-muted/60 p-1">
                    <TabsTrigger value="polish" className="flex-1 px-2 text-xs">Polish</TabsTrigger>
                    <TabsTrigger value="narrative" className="flex-1 px-2 text-xs">Narrative</TabsTrigger>
                    <TabsTrigger value="critique" className="flex-1 px-2 text-xs">Critique</TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>

              <div>
                <label className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground" htmlFor="ai-brief">
                  Optional angle
                </label>
                <Textarea
                  id="ai-brief"
                  aria-label="AI creative brief"
                  value={brief}
                  onChange={(event) => setBrief(event.target.value.slice(0, 480))}
                  disabled={loading}
                  className="mt-2 min-h-20 resize-y text-sm"
                  placeholder="e.g. Keep a calm, practical tone for people rebuilding a habit."
                />
              </div>

              {error ? <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs leading-relaxed text-destructive">{error}</p> : null}

              <Button type="button" className="h-10 w-full" disabled={cannotRun} onClick={generate}>
                {loading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : <WandSparkles className="h-4 w-4" />}
                {loading ? "Reviewing campaign…" : "Generate suggestions"}
              </Button>
              {campaignSlides.length === 0 ? (
                <p className="text-xs text-destructive">Add a headline to at least one slide before using AI polish.</p>
              ) : null}
            </div>
          </section>

          <section className="min-h-96 p-6">
            {proposal ? (
              <div className="space-y-4">
                <div className="border-b border-border/70 pb-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Suggested direction</p>
                  <p className="store-panel-title mt-1 text-lg leading-snug">{proposal.summary}</p>
                  {(suggestedTemplate || suggestedPalette) ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {suggestedTemplate ? (
                        <Button variant="outline" size="sm" onClick={() => onApplyTemplate(suggestedTemplate.id)}>
                          Use {suggestedTemplate.name}
                        </Button>
                      ) : null}
                      {suggestedPalette ? (
                        <Button variant="outline" size="sm" onClick={() => onApplyPalette(suggestedPalette.id)}>
                          Use {suggestedPalette.name}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="store-scrollbar max-h-[360px] space-y-3 overflow-y-auto pr-1">
                  {proposal.slides.map((suggestion) => {
                    const original = originalById.get(suggestion.id);
                    return (
                      <article key={suggestion.id} className="rounded-lg border border-border/70 bg-background/45 p-3">
                        <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">{original?.label || "Slide"}</p>
                        <p className="mt-1 text-xs text-muted-foreground line-through decoration-muted-foreground/40">{original?.headline}</p>
                        <p className="mt-2 whitespace-pre-line text-sm font-medium leading-snug text-foreground">{suggestion.headline}</p>
                        <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{suggestion.rationale}</p>
                      </article>
                    );
                  })}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-4">
                  <p className="text-xs text-muted-foreground">Apply only when the direction feels right. Undo remains available.</p>
                  <Button
                    size="sm"
                    onClick={() => {
                      onApplyProposal(proposal);
                      handleOpenChange(false);
                    }}
                  >
                    <Check className="h-4 w-4" /> Apply {proposal.slides.length} suggestion{proposal.slides.length === 1 ? "" : "s"}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex min-h-80 flex-col justify-between rounded-lg border border-dashed border-border/80 bg-muted/30 p-5">
                <div>
                  <Sparkles className="h-5 w-5 text-[hsl(var(--accent))]" />
                  <h3 className="store-panel-title mt-3 text-xl">A review, not a rewrite.</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                    The proposal stays in this panel until you choose to apply it. Screenshots,
                    semantic capture IDs, layout and export settings remain untouched.
                  </p>
                </div>
                <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">
                  <span className="rounded-md bg-background/70 p-2">One idea per slide</span>
                  <span className="rounded-md bg-background/70 p-2">Readable at thumbnail size</span>
                  <span className="rounded-md bg-background/70 p-2">Localized copy stays localized</span>
                </div>
              </div>
            )}
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
