"use client";
import * as React from "react";
import {
  AlertTriangle,
  Check,
  Cloud,
  Download,
  Link2,
  RotateCcw,
  ShieldAlert,
  ShieldCheck,
  UnfoldHorizontal,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DEVICE_LABEL,
  supportsLandscape,
} from "@/lib/constants";
import { detectPlatform } from "@/lib/defaults";
import type { AiProposal } from "@/lib/ai";
import type { CampaignImportOptions, CampaignImportProposal } from "@/lib/app-store-import";
import type { AccentMode, BrandTokens, CampaignTemplate, Device, Orientation, Slide, TemplateApplyOptions, Theme, TypographyTokens } from "@/lib/types";
import type { ValidationResult } from "@/lib/validation";
import { AiPolish } from "./ai-polish";
import { AppStoreImporter } from "./app-store-importer";
import { CampaignWardrobe } from "./campaign-wardrobe";
import { ProjectSwitcher } from "./project-switcher";
import { ExportSizePicker } from "./export-size-picker";
import type { LocalProjectSummary } from "@/lib/project-library";
import type { ProjectState } from "@/lib/types";

type Props = {
  appName: string;
  setAppName: (v: string) => void;
  projectState: ProjectState;
  projects: LocalProjectSummary[];
  activeProjectId: string | null;
  onSwitchProject: (projectId: string) => boolean;
  onCreateProject: () => string;
  onImportProject: (raw: unknown) =>
    | { ok: true; projectId: string; name: string }
    | { ok: false; error: string };
  connectedCanvas: boolean;
  setConnectedCanvas: (v: boolean) => void;
  copyLinked: boolean;
  onCopyLinkChange: (enabled: boolean) => void;
  locale: string;
  setLocale: (v: string) => void;
  locales: string[];
  device: Device;
  slides: Slide[];
  setDevice: (v: Device) => void;
  orientation: Orientation;
  setOrientation: (v: Orientation) => void;
  exportSizeIds?: ProjectState["exportSizeIds"];
  onExportSizeIdsChange: (device: Device, ids: string[]) => void;
  onExport: () => void;
  onResetAll: () => void;
  onResetDevice: () => void;
  exporting: string | null;
  savedAt: number | null;
  saveError: string | null;
  fileSyncAvailable: boolean;
  busy: boolean;
  templateId?: string;
  customTemplate?: CampaignTemplate;
  paletteId?: string;
  customPaletteName?: string;
  campaignSourceUrl?: string;
  brandColors?: BrandTokens["colors"];
  brandTypography?: BrandTokens["typography"];
  theme: Theme;
  accentMode?: AccentMode;
  onTemplateChange: (templateId: string, options?: TemplateApplyOptions) => void;
  onPaletteChange: (paletteId: string) => void;
  onCustomColorsChange: (colors: NonNullable<BrandTokens["colors"]>) => void;
  onTypographyChange: (typography: TypographyTokens) => void;
  onAccentModeChange: (mode: AccentMode) => void;
  onApplyCampaignImport: (proposal: CampaignImportProposal, options: CampaignImportOptions) => void;
  onApplyAiProposal: (proposal: AiProposal) => void;
  validation: ValidationResult;
};

export function Toolbar(props: Props) {
  const platform = detectPlatform(props.device);
  const hasLandscape = supportsLandscape(props.device);
  const [resetOpen, setResetOpen] = React.useState(false);
  const [qaOpen, setQaOpen] = React.useState(false);

  // Track last device per platform so iOS/Android tabs preserve user's choice.
  const lastByPlatform = React.useRef<{ ios: Device; android: Device }>({
    ios: platform === "ios" ? props.device : "iphone",
    android: platform === "android" ? props.device : "android",
  });
  React.useEffect(() => {
    lastByPlatform.current[platform] = props.device;
  }, [platform, props.device]);

  const showLocale = props.locales.length > 1;

  const deviceLabel = DEVICE_LABEL[props.device];

  return (
    <div className="store-toolbar flex flex-wrap items-center gap-x-1.5 gap-y-2 border-b px-3 py-2 sm:px-4 md:gap-x-2 md:gap-y-1.5">
      <div className="store-wordmark mr-1 hidden items-center gap-2 lg:flex" aria-label="StoreCanvas">
        <span className="store-wordmark-mark">S</span>
        <span className="text-xs font-semibold tracking-[0.12em]">STORECANVAS</span>
      </div>
      <ProjectSwitcher
        state={props.projectState}
        projects={props.projects}
        activeProjectId={props.activeProjectId}
        disabled={props.busy}
        onSwitchProject={props.onSwitchProject}
        onCreateProject={props.onCreateProject}
        onImportProject={props.onImportProject}
      />
      <Input
        value={props.appName}
        onChange={(e) => props.setAppName(e.target.value)}
        className="h-8 w-32 border-dashed text-sm font-semibold focus-visible:border-input focus-visible:border-solid focus-visible:bg-background sm:w-40"
        placeholder="App name"
        aria-label="App name"
        title="App name (click to edit)"
        disabled={props.busy}
      />

      <span aria-hidden className="mx-1 hidden h-5 w-px bg-border md:block" />

      <Button
        type="button"
        variant={props.connectedCanvas ? "secondary" : "outline"}
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => props.setConnectedCanvas(!props.connectedCanvas)}
        aria-pressed={props.connectedCanvas}
        title={
          props.connectedCanvas
            ? "Connected canvas enabled"
            : "Isolated screens; turn on to let elements cross screen edges"
        }
        disabled={props.busy}
      >
        <UnfoldHorizontal className="h-3.5 w-3.5" />
        {props.connectedCanvas ? "Connected" : "Isolated"}
      </Button>

      <span aria-hidden className="mx-1 hidden h-5 w-px bg-border md:block" />

      <Tabs
        value={platform}
        onValueChange={(p) => {
          if (props.busy) return;
          const next = p === "ios" ? lastByPlatform.current.ios : lastByPlatform.current.android;
          props.setDevice(next);
        }}
      >
        <TabsList className="h-8 p-0.5">
          <TabsTrigger value="ios" className="h-7 px-3 text-xs" disabled={props.busy}>
            iOS
          </TabsTrigger>
          <TabsTrigger value="android" className="h-7 px-3 text-xs" disabled={props.busy}>
            Android
          </TabsTrigger>
        </TabsList>
      </Tabs>

      <Select
        value={props.device}
        onValueChange={(v) => props.setDevice(v as Device)}
        disabled={props.busy}
      >
        <SelectTrigger aria-label="Device" className="h-8 w-44 text-xs">
          <SelectValue placeholder="Device">{deviceLabel}</SelectValue>
        </SelectTrigger>
        <SelectContent>
          {platform === "ios" ? (
            <>
              <SelectItem value="iphone">{DEVICE_LABEL.iphone}</SelectItem>
              <SelectItem value="ipad">{DEVICE_LABEL.ipad}</SelectItem>
            </>
          ) : (
            <>
              <SelectItem value="android">{DEVICE_LABEL.android}</SelectItem>
              <SelectItem value="android-7">{DEVICE_LABEL["android-7"]}</SelectItem>
              <SelectItem value="android-10">{DEVICE_LABEL["android-10"]}</SelectItem>
              <SelectItem value="feature-graphic">{DEVICE_LABEL["feature-graphic"]}</SelectItem>
            </>
          )}
        </SelectContent>
      </Select>

      {hasLandscape && (
        <Select
          value={props.orientation}
          onValueChange={(v) => props.setOrientation(v as Orientation)}
          disabled={props.busy}
        >
          <SelectTrigger className="h-8 w-32 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="portrait">Portrait</SelectItem>
            <SelectItem value="landscape">Landscape</SelectItem>
          </SelectContent>
        </Select>
      )}

      <ExportSizePicker
        device={props.device}
        orientation={props.orientation}
        selectedIds={props.exportSizeIds?.[props.device]}
        onChange={(ids) => props.onExportSizeIdsChange(props.device, ids)}
        disabled={props.busy}
      />

      {showLocale && (
        <Select value={props.locale} onValueChange={props.setLocale} disabled={props.busy}>
          <SelectTrigger aria-label="Locale" className="h-8 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {props.locales.map((l) => (
              <SelectItem key={l} value={l}>
                {l.toUpperCase()}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <Button
        type="button"
        variant={props.copyLinked ? "secondary" : "ghost"}
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        onClick={() => props.onCopyLinkChange(!props.copyLinked)}
        aria-label={props.copyLinked ? "Unlink copy across devices" : "Link copy across devices"}
        aria-pressed={props.copyLinked}
        title={props.copyLinked ? "Copy continuity is on" : "Keep matching screen copy consistent across devices"}
        disabled={props.busy}
      >
        <Link2 className="h-3.5 w-3.5" />
        <span className="hidden 2xl:inline">{props.copyLinked ? "Copy linked" : "Link copy"}</span>
      </Button>

      <AppStoreImporter
        appName={props.appName}
        currentSourceUrl={props.campaignSourceUrl}
        disabled={props.busy}
        onApply={props.onApplyCampaignImport}
      />
      <CampaignWardrobe
        device={props.device}
        templateId={props.templateId}
        customTemplate={props.customTemplate}
        paletteId={props.paletteId}
        customPaletteName={props.customPaletteName}
        colors={props.brandColors}
        typography={props.brandTypography}
        theme={props.theme}
        accentMode={props.accentMode}
        disabled={props.busy}
        onTemplateChange={props.onTemplateChange}
        onPaletteChange={props.onPaletteChange}
        onCustomColorsChange={props.onCustomColorsChange}
        onTypographyChange={props.onTypographyChange}
        onAccentModeChange={props.onAccentModeChange}
      />
      <AiPolish
        appName={props.appName}
        locale={props.locale}
        device={props.device}
        slides={props.slides}
        templateId={props.templateId}
        paletteId={props.paletteId}
        disabled={props.busy}
        onApplyProposal={props.onApplyAiProposal}
        onApplyTemplate={props.onTemplateChange}
        onApplyPalette={props.onPaletteChange}
      />

      <div className="flex w-full shrink-0 items-center justify-between gap-1.5 md:ml-auto md:w-auto md:justify-end md:gap-2">
        <SaveStatus savedAt={props.savedAt} saveError={props.saveError} fileSyncAvailable={props.fileSyncAvailable} />
        <span aria-hidden className="hidden h-5 w-px bg-border md:block" />
        <Button
          type="button"
          variant={props.validation.valid ? "ghost" : "outline"}
          size="sm"
          className="h-8 gap-1.5 px-2 text-xs"
          onClick={() => setQaOpen(true)}
          title="Review export preflight checks"
          aria-label="Preflight QA"
        >
          {props.validation.valid ? (
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
          ) : (
            <ShieldAlert className="h-3.5 w-3.5 text-amber-600" />
          )}
          QA {props.validation.valid ? "ready" : `${props.validation.errors.length} issue${props.validation.errors.length === 1 ? "" : "s"}`}
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={() => setResetOpen(true)}
          title="Reset screens to defaults"
          aria-label="Reset"
          disabled={props.busy}
        >
          <RotateCcw className="h-4 w-4" />
        </Button>
        <Button
          onClick={props.onExport}
          disabled={!!props.exporting}
          size="sm"
          className="h-8"
          title="Export selected sizes × locale for this device as a zip"
        >
          <Download className="h-4 w-4" />
          <span className="hidden sm:inline">
            {props.exporting ? `Exporting ${props.exporting}` : "Export bundle"}
          </span>
        </Button>
      </div>

      <Dialog open={qaOpen} onOpenChange={setQaOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {props.validation.valid ? <ShieldCheck className="h-5 w-5 text-emerald-600" /> : <ShieldAlert className="h-5 w-5 text-amber-600" />}
              Preflight QA
            </DialogTitle>
            <DialogDescription>
              {props.validation.valid
                ? "This campaign is ready for PNG export."
                : "Resolve the blockers below before producing store-ready files."}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-72 space-y-2 overflow-y-auto rounded-md border bg-muted/30 p-3 text-xs">
            {props.validation.issues.length === 0 ? (
              <p className="flex items-center gap-2 text-emerald-700"><ShieldCheck className="h-4 w-4" /> No blockers found.</p>
            ) : (
              props.validation.issues.map((issue, index) => (
                <div key={`${issue.code}-${issue.slideId || "project"}-${index}`} className="flex gap-2 rounded border bg-background/70 p-2">
                  {issue.severity === "error" ? <ShieldAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-destructive" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                  <span>{issue.message}</span>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reset to defaults?</DialogTitle>
            <DialogDescription>
              Choose whether to reset just <span className="font-medium">{deviceLabel}</span> or every device deck. Your canvas edits, uploaded screenshots, and copy will be lost.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                props.onResetDevice();
              }}
            >
              Reset {deviceLabel} only
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setResetOpen(false);
                props.onResetAll();
              }}
            >
              Reset all devices
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SaveStatus({ savedAt, saveError, fileSyncAvailable }: { savedAt: number | null; saveError: string | null; fileSyncAvailable: boolean }) {
  const [, setTick] = React.useState(0);
  React.useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 60_000);
    return () => clearInterval(t);
  }, []);

  if (saveError) {
    return (
      <span
        className="flex items-center gap-1 text-xs text-destructive"
        title={saveError}
      >
        <AlertTriangle className="h-3.5 w-3.5" /> save failed
      </span>
    );
  }

  if (!savedAt) {
    return (
      <span className="flex items-center gap-1 text-xs text-muted-foreground">
        <Cloud className="h-3.5 w-3.5" /> not saved yet
      </span>
    );
  }
  const seconds = Math.max(0, Math.round((Date.now() - savedAt) / 1000));
  const label =
    seconds < 5
      ? fileSyncAvailable ? "saved locally + file" : "saved locally"
      : seconds < 60
        ? `${fileSyncAvailable ? "saved + file" : "saved locally"} ${seconds}s ago`
        : seconds < 3600
          ? `${fileSyncAvailable ? "saved + file" : "saved locally"} ${Math.round(seconds / 60)}m ago`
          : `${fileSyncAvailable ? "saved + file" : "saved locally"} ${Math.round(seconds / 3600)}h ago`;
  return (
    <span className="flex items-center gap-1 text-xs text-muted-foreground">
      <Check className="h-3.5 w-3.5 text-green-500" /> {label}
    </span>
  );
}
