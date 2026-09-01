"use client";
import * as React from "react";
import JSZip from "jszip";
import { toPng } from "html-to-image";
import { Toaster, toast } from "sonner";
import {
  getExportSizes,
  hasTheme,
  supportsLandscape,
  themeById,
} from "@/lib/constants";
import { detectPlatform, nid } from "@/lib/defaults";
import { artworkKey, deviceSlotKey, isArtworkElementId, isBuiltInElementId, isDeviceSlotElementId, isTextElementId, textElementKey } from "@/lib/elements";
import { preloadImages } from "@/lib/image-cache";
import { resolveScreenshot, writeLocalized } from "@/lib/locale";
import { buildAssetLibrary } from "@/lib/asset-library";
import { exportPath } from "@/lib/export-naming";
import { useProject } from "@/lib/storage";
import { validateProject } from "@/lib/validation";
import { applyBrandTokens } from "@/lib/theme";
import { applyAiProposal } from "@/lib/ai";
import { applyCampaignImport } from "@/lib/app-store-import";
import { setCopyLinking, writeLinkedCopy } from "@/lib/copy-sync";
import {
  applyCampaignTemplate,
  applyCampaignTemplateDefinition,
  applyCustomColors,
  applyPalette,
  campaignTemplateById,
  paletteById,
} from "@/lib/campaign-presets";
import type {
  BuiltInElementId,
  Device,
  ElementId,
  ElementTransform,
  SelectedElement,
  Slide,
} from "@/lib/types";
import { Inspector } from "./inspector";
import { PreviewStage } from "./preview-stage";
import { Sidebar } from "./sidebar";
import { DeckCanvas, getCanvas } from "./slide-canvas";
import { Toolbar } from "./toolbar";

export function ScreenshotEditor() {
  const {
    state,
    setState,
    hydrated,
    savedAt,
    saveError,
    fileSyncAvailable,
    projects,
    activeProjectId,
    switchProject,
    createProject,
    importProject,
    reset,
    resetDevice,
    undo,
    redo,
  } = useProject();
  const [activeSlideId, setActiveSlideId] = React.useState<string | null>(null);
  const [selectedElement, setSelectedElement] = React.useState<SelectedElement | null>(null);
  const [exporting, setExporting] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState(false);
  const [exportLocaleOverride, setExportLocaleOverride] = React.useState<string | null>(null);
  const [exportSlideIndex, setExportSlideIndex] = React.useState(0);
  const exportRef = React.useRef<HTMLDivElement | null>(null);

  const currentSlides = state.slidesByDevice[state.device] || [];
  const activeSlide =
    currentSlides.find((s) => s.id === activeSlideId) || currentSlides[0] || null;
  const activeSlideIndex = Math.max(0, currentSlides.findIndex((slide) => slide.id === activeSlide?.id));
  const maxArtworkSpan = Math.max(1, Math.min(10, currentSlides.length - activeSlideIndex));
  const artworkTonePattern = currentSlides
    .slice(activeSlideIndex, activeSlideIndex + maxArtworkSpan)
    .map((slide): "light" | "dark" => (slide.inverted ? "dark" : "light"));
  const theme = applyBrandTokens(themeById(state.themeId), state.brand);
  const assetLibrary = React.useMemo(() => buildAssetLibrary(state), [state]);
  const validation = React.useMemo(() => validateProject(state, { strict: true }), [state]);

  React.useEffect(() => {
    if (selectedElement && selectedElement.slideId !== activeSlide?.id) {
      setSelectedElement(null);
    }
  }, [activeSlide?.id, selectedElement]);

  React.useEffect(() => {
    if (!hydrated) return;
    if (!activeSlide && currentSlides.length > 0) {
      setActiveSlideId(currentSlides[0].id);
    }
  }, [hydrated, currentSlides, activeSlide]);

  React.useEffect(() => {
    if (!supportsLandscape(state.device) && state.orientation !== "portrait") {
      setState((p) => ({ ...p, orientation: "portrait" }));
    }
  }, [state.device, state.orientation, setState]);

  React.useEffect(() => {
    if (hydrated && state.themeId && !hasTheme(state.themeId)) {
      toast.warning("Using fallback theme", {
        description: `Theme "${state.themeId}" is not defined in src/lib/constants.ts.`,
        duration: 8000,
      });
    }
  }, [hydrated, state.themeId]);

  const assetPaths = React.useMemo(() => {
    const paths = new Set<string>();
    paths.add("/screenshots/demo/overview.svg");
    if (state.appIcon) paths.add(state.appIcon);
    // Preload every locale variant so bulk export doesn't race image loads.
    const allSlides: Slide[] = Object.values(state.slidesByDevice).flat();
    for (const asset of Object.values(assetLibrary)) {
      for (const raw of Object.values(asset.paths)) {
        if (!raw || raw.startsWith("data:")) continue;
        if (raw.includes("{locale}")) {
          for (const loc of state.locales) paths.add(resolveScreenshot(raw, loc));
        } else {
          paths.add(raw);
        }
      }
    }
    for (const s of allSlides) {
    for (const raw of [s.screenshot, s.screenshotSecondary, ...(s.deviceSlots || []).map((slot) => slot.screenshot), ...(s.connectedArtworks || []).map((artwork) => artwork.image)]) {
        if (!raw || raw.startsWith("data:")) continue;
        if (raw.includes("{locale}")) {
          for (const loc of state.locales) paths.add(resolveScreenshot(raw, loc));
        } else {
          paths.add(raw);
        }
      }
    }
    return Array.from(paths).sort();
  }, [state.slidesByDevice, state.appIcon, state.locales, assetLibrary]);
  const assetSig = assetPaths.join("|");

  React.useEffect(() => {
    if (!hydrated) return;
    preloadImages(assetPaths).finally(() => setReady(true));
    // assetPaths is derived from assetSig; depending on the string keeps the
    // effect from re-firing when slidesByDevice churns without path changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hydrated, assetSig]);

  // Surface storage failures (quota exceeded etc.) so the user knows their work isn't safe.
  React.useEffect(() => {
    if (saveError) {
      toast.error("Couldn't load or save project file", {
        description: saveError,
        duration: 8000,
      });
    }
  }, [saveError]);

  // ---------- Mutations ----------

  const patchSlide = React.useCallback(
    (id: string, patch: Partial<Slide>) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((s) =>
            s.id === id ? { ...s, ...patch } : s,
          ),
        },
      }));
    },
    [setState],
  );

  const reorderSlides = React.useCallback(
    (next: Slide[]) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
      }));
    },
    [setState],
  );

  const deleteSlide = React.useCallback(
    (id: string) => {
      const dev = state.device;
      const slides = state.slidesByDevice[dev] || [];
      const idx = slides.findIndex((s) => s.id === id);
      if (idx === -1) return;
      const snap = slides[idx];
      const fallback = slides[idx + 1] || slides[idx - 1] || null;

      setState((prev) => {
        const cur = prev.slidesByDevice[dev] || [];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [dev]: cur.filter((s) => s.id !== id) },
        };
      });
      setActiveSlideId((cur) => (cur === id ? fallback?.id || null : cur));

      toast("Screen deleted", {
        action: {
          label: "Undo",
          onClick: () => {
            setState((prev) => {
              const cur = prev.slidesByDevice[dev] || [];
              if (cur.some((s) => s.id === snap.id)) return prev;
              const restored = [...cur.slice(0, idx), snap, ...cur.slice(idx)];
              return {
                ...prev,
                slidesByDevice: { ...prev.slidesByDevice, [dev]: restored },
              };
            });
            setActiveSlideId(snap.id);
          },
        },
        duration: 6000,
      });
    },
    [setState, state.device, state.slidesByDevice],
  );

  const addSlide = React.useCallback(
    (slide: Slide) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: [...(prev.slidesByDevice[prev.device] || []), slide],
        },
      }));
      setActiveSlideId(slide.id);
    },
    [setState],
  );

  const patchLocalized = React.useCallback(
    (slide: Slide, key: "label" | "headline", value: string) => {
      setState((project) => writeLinkedCopy(project, project.device, slide.id, key, project.locale, value));
    },
    [setState],
  );

  const patchElementTransform = React.useCallback(
    (slideId: string, elementId: ElementId, transform: ElementTransform) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) => {
            if (slide.id !== slideId) return slide;
            if (isTextElementId(elementId)) {
              const textId = textElementKey(elementId);
              return {
                ...slide,
                textElements: (slide.textElements || []).map((element) =>
                  element.id === textId ? { ...element, transform } : element,
                ),
              };
            }
            if (isArtworkElementId(elementId)) {
              const artworkId = artworkKey(elementId);
              return {
                ...slide,
                connectedArtworks: (slide.connectedArtworks || []).map((artwork) =>
                  artwork.id === artworkId ? { ...artwork, transform } : artwork,
                ),
              };
            }
            if (isDeviceSlotElementId(elementId)) {
              const slotId = deviceSlotKey(elementId);
              return {
                ...slide,
                deviceSlots: (slide.deviceSlots || []).map((slot) =>
                  slot.id === slotId ? { ...slot, transform } : slot,
                ),
              };
            }
            if (!isBuiltInElementId(elementId)) return slide;
            return {
              ...slide,
              transforms: {
                ...(slide.transforms || {}),
                [elementId]: transform,
              } as Partial<Record<BuiltInElementId, ElementTransform>>,
            };
          }),
        },
      }));
    },
    [setState],
  );

  const patchTextElementText = React.useCallback(
    (slideId: string, textId: string, value: string) => {
      setState((prev) => ({
        ...prev,
        slidesByDevice: {
          ...prev.slidesByDevice,
          [prev.device]: (prev.slidesByDevice[prev.device] || []).map((slide) =>
            slide.id === slideId
              ? {
                  ...slide,
                  textElements: (slide.textElements || []).map((element) =>
                    element.id === textId
                      ? { ...element, text: writeLocalized(element.text, prev.locale, value) }
                      : element,
                  ),
                }
              : slide,
          ),
        },
      }));
    },
    [setState],
  );

  const duplicateSlide = React.useCallback(
    (id: string) => {
      let newId: string | null = null;
      setState((prev) => {
        const slides = prev.slidesByDevice[prev.device] || [];
        const idx = slides.findIndex((s) => s.id === id);
        if (idx === -1) return prev;
        const src = slides[idx];
        newId = nid();
        const copy: Slide = {
          ...src,
          id: newId,
          label: { ...src.label },
          headline: { ...src.headline },
          transforms: src.transforms
            ? Object.fromEntries(
                Object.entries(src.transforms).map(([key, value]) => [key, { ...value }]),
              )
            : undefined,
          textElements: src.textElements?.map((element) => ({
            ...element,
            id: nid(),
            text: { ...element.text },
            transform: { ...element.transform },
          })),
          deviceSlots: src.deviceSlots?.map((slot) => ({
            ...slot,
            id: nid(),
            transform: { ...slot.transform },
            presentation: slot.presentation ? { ...slot.presentation } : undefined,
          })),
          presentations: src.presentations
            ? Object.fromEntries(Object.entries(src.presentations).map(([key, value]) => [key, { ...value }]))
            : undefined,
        };
        const next = [...slides.slice(0, idx + 1), copy, ...slides.slice(idx + 1)];
        return {
          ...prev,
          slidesByDevice: { ...prev.slidesByDevice, [prev.device]: next },
        };
      });
      if (newId) setActiveSlideId(newId);
    },
    [setState],
  );

  // ---------- Keyboard shortcuts ----------

  React.useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const inEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          (target as HTMLElement).isContentEditable);
      if (exporting) return;

      if (e.key === "Escape") {
        setSelectedElement(null);
        if (target && "blur" in target && typeof target.blur === "function") target.blur();
        return;
      }

      // Let focused inputs and contenteditable text keep their native undo,
      // redo, selection, and deletion behavior.
      if (inEditable) return;

      if ((e.metaKey || e.ctrlKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
        return;
      }
      if ((e.metaKey || e.ctrlKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        redo();
        return;
      }
      if (!currentSlides.length) return;
      const idx = activeSlide ? currentSlides.findIndex((s) => s.id === activeSlide.id) : -1;
      if (e.key === "ArrowDown" || (e.key === "j" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.min(currentSlides.length - 1, idx + 1)];
        if (next) setActiveSlideId(next.id);
      } else if (e.key === "ArrowUp" || (e.key === "k" && !e.metaKey && !e.ctrlKey)) {
        e.preventDefault();
        const next = currentSlides[Math.max(0, idx - 1)];
        if (next) setActiveSlideId(next.id);
      } else if ((e.key === "d" || e.key === "D") && (e.metaKey || e.ctrlKey)) {
        if (activeSlide) {
          e.preventDefault();
          duplicateSlide(activeSlide.id);
        }
      } else if ((e.key === "Backspace" || e.key === "Delete") && (e.metaKey || e.ctrlKey)) {
        if (activeSlide) {
          e.preventDefault();
          deleteSlide(activeSlide.id);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activeSlide, currentSlides, duplicateSlide, deleteSlide, exporting, undo, redo]);

  // ---------- Export ----------

  // Wait two animation frames so React's render → browser layout/paint of the
  // off-screen container settles before html-to-image snapshots it. One frame
  // is occasionally not enough on slower machines.
  const waitForPaint = () =>
    new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    });

  async function exportAll() {
    if (!currentSlides.length) {
      toast.error("No screens to export");
      return;
    }

    if (!validation.valid) {
      toast.error("Resolve QA blockers before exporting", {
        description: validation.errors.slice(0, 3).map((issue) => issue.message).join(" "),
      });
      return;
    }

    const sizes = getExportSizes(state.device, state.orientation);
    if (!sizes.length) {
      toast.error("Nothing to export");
      return;
    }
    const locales = state.locales;
    await preloadImages(assetPaths, { retryFailed: true });
    await waitForPaint();

    const missingScreens = currentSlides
      .map((slide, index) => ({ slide, index }))
      .filter(({ slide }) => slideNeedsScreenshot(state.device, slide) && !slide.screenshot);
    const reusedBackScreens = currentSlides
      .map((slide, index) => ({ slide, index }))
      .filter(
        ({ slide }) =>
          state.device !== "feature-graphic" &&
          slide.layout === "two-devices" &&
          slide.screenshot &&
          !slide.screenshotSecondary,
      );
    if (missingScreens.length > 0 || reusedBackScreens.length > 0) {
      const details = [
        missingScreens.length
          ? `${missingScreens.length} screen${missingScreens.length === 1 ? "" : "s"} will export with an empty device.`
          : null,
        reusedBackScreens.length
          ? `${reusedBackScreens.length} two-device screen${reusedBackScreens.length === 1 ? "" : "s"} will reuse the primary screenshot in back.`
          : null,
      ].filter(Boolean);
      toast.warning("Export includes placeholder screenshots", {
        description: details.join(" "),
        duration: 7000,
      });
    }

    // Make sure custom fonts are loaded before snapshot so typography in PNG
    // matches what's on screen.
    if (typeof document !== "undefined" && document.fonts && document.fonts.ready) {
      try {
        await document.fonts.ready;
      } catch {
        /* ignore */
      }
    }

    const { cW, cH } = getCanvas(state.device, state.orientation);
    const platform = detectPlatform(state.device);
    const zip = new JSZip();
    const totalUnits = sizes.length * locales.length * currentSlides.length;
    let unit = 0;
    let okCount = 0;
    let failed = 0;
    const errors: string[] = [];

    for (const locale of locales) {
      setExportLocaleOverride(locale);
      await waitForPaint();

      for (const size of sizes) {
        for (let i = 0; i < currentSlides.length; i++) {
          const slide = currentSlides[i];
          unit += 1;
          setExporting(`${unit}/${totalUnits}`);
          setExportSlideIndex(i);
          await waitForPaint();
          const el = exportRef.current;
          if (!el) {
            failed += 1;
            errors.push(`${locale} ${size.w}×${size.h} screen ${i + 1}: render target missing`);
            continue;
          }
          try {
            const dataUrl = await captureSlide(el, cW, cH, size.w, size.h);
            const base64 = dataUrl.split(",")[1] || "";
            const path = exportPath({
              platform,
              device: state.device,
              width: size.w,
              height: size.h,
              locale,
              index: i,
              layout: slide.layout,
            });
            zip.file(path, base64, { base64: true });
            okCount += 1;
          } catch (e) {
            failed += 1;
            const msg = e instanceof Error ? e.message : String(e);
            errors.push(`${locale} ${size.w}×${size.h} screen ${i + 1}: ${msg}`);
            console.error("Export failed", { slideId: slide.id, locale, size }, e);
          }
        }
      }
    }

    setExportLocaleOverride(null);
    setExporting(null);

    if (okCount > 0) {
      try {
        const blob = await zip.generateAsync({ type: "blob" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${slugify(state.appName)}-${platform}-${state.device}-${stamp()}.zip`;
        a.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
      } catch (e) {
        toast.error("Couldn't bundle export");
        console.error(e);
        return;
      }
    }

    const summary = `${locales.length} locale${locales.length === 1 ? "" : "s"} × ${sizes.length} size${sizes.length === 1 ? "" : "s"}`;
    if (failed === 0) {
      toast.success(`Exported ${okCount} PNGs (${summary})`);
    } else if (okCount === 0) {
      toast.error(`All ${failed} renders failed`, {
        description: errors.slice(0, 3).join("\n"),
      });
    } else {
      toast.error(`${failed} of ${totalUnits} renders failed`, {
        description: errors.slice(0, 3).join("\n"),
      });
    }
  }

  async function captureSlide(
    el: HTMLElement,
    sourceW: number,
    sourceH: number,
    exportW: number,
    exportH: number,
  ) {
    // html-to-image needs the node at (0,0). Let the library scale the source
    // canvas into the requested output dimensions; CSS transforms leave
    // transparent gutters when export aspect ratios differ by a few pixels.
    const prev = {
      left: el.style.left,
      top: el.style.top,
      position: el.style.position,
      transform: el.style.transform,
      transformOrigin: el.style.transformOrigin,
      zIndex: el.style.zIndex,
    };
    el.style.left = "0px";
    el.style.top = "0px";
    el.style.position = "absolute";
    el.style.transform = "none";
    el.style.transformOrigin = "top left";
    el.style.zIndex = "-1";
    try {
      const dataUrl = await toPng(el, {
        width: sourceW,
        height: sourceH,
        canvasWidth: exportW,
        canvasHeight: exportH,
        pixelRatio: 1,
        cacheBust: false,
        backgroundColor: "#ffffff",
      });
      return dataUrl;
    } finally {
      el.style.left = prev.left || "-99999px";
      el.style.top = prev.top || "0px";
      el.style.position = prev.position || "absolute";
      el.style.transform = prev.transform;
      el.style.transformOrigin = prev.transformOrigin;
      el.style.zIndex = prev.zIndex;
    }
  }

  // ---------- Render ----------

  if (!hydrated || !ready) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-current border-t-transparent" />
          <p className="text-sm">Loading editor…</p>
        </div>
      </div>
    );
  }

  const { cW, cH } = getCanvas(state.device, state.orientation);
  const busy = !!exporting;

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <Toaster position="bottom-right" richColors closeButton />
      <Toolbar
        appName={state.appName}
        setAppName={(v) => setState((p) => ({ ...p, appName: v }))}
        projectState={state}
        projects={projects}
        activeProjectId={activeProjectId}
        onSwitchProject={switchProject}
        onCreateProject={() => createProject()}
        onImportProject={importProject}
        connectedCanvas={state.connectedCanvas}
        setConnectedCanvas={(v) => setState((p) => ({ ...p, connectedCanvas: v }))}
        locale={state.locale}
        setLocale={(v) => setState((p) => ({ ...p, locale: v }))}
        locales={state.locales}
        device={state.device}
        slides={currentSlides}
        setDevice={(v) => setState((p) => ({ ...p, device: v }))}
        orientation={state.orientation}
        setOrientation={(v) => setState((p) => ({ ...p, orientation: v }))}
        onExport={exportAll}
        onResetAll={() => {
          reset();
          setActiveSlideId(null);
          toast.success("Reset all devices to defaults");
        }}
        onResetDevice={() => {
          resetDevice(state.device);
          setActiveSlideId(null);
          toast.success(`Reset ${state.device} to defaults`);
        }}
        exporting={exporting}
        savedAt={savedAt}
        saveError={saveError}
        fileSyncAvailable={fileSyncAvailable}
        busy={busy}
        templateId={state.templateId}
        customTemplate={state.customTemplate}
        paletteId={state.paletteId}
        customPaletteName={state.customPaletteName}
        campaignSourceUrl={state.campaignSource?.sourceUrl}
        copyLinked={state.copySync?.enabled === true}
        brandColors={state.brand?.colors}
        onTemplateChange={(templateId, options) => {
          const template = state.customTemplate?.id === templateId ? state.customTemplate : campaignTemplateById(templateId);
          setState((project) => project.customTemplate?.id === templateId
            ? applyCampaignTemplateDefinition(project, project.customTemplate, project.device, options)
            : applyCampaignTemplate(project, templateId, project.device, options));
          toast.success(`${template?.name || "Template"} applied`, {
            description: options?.resetCustomizations
              ? "The template rebuilt manual placement and reflowed connected artwork."
              : "Captures and manual placement stayed independent; connected artwork moved to the designed seams.",
          });
        }}
        onPaletteChange={(paletteId) => {
          const palette = paletteById(paletteId);
          setState((project) => applyPalette(project, paletteId));
          toast.success(`${palette?.name || "Palette"} applied`, {
            description: "Your campaign colors changed; captures and typography stayed intact.",
          });
        }}
        onCustomColorsChange={(colors) => {
          setState((project) => applyCustomColors(project, colors));
          toast.success("Custom colors applied", {
            description: "Screenshots, layouts, typography and localized copy stayed in place.",
          });
        }}
        onApplyCampaignImport={(proposal, options) => {
          setState((project) => applyCampaignImport(project, proposal, options));
          toast.success(`${proposal.listing.name} campaign applied`, {
            description: "The generated template, palette and copy remain editable; published composites stayed reference-only unless selected.",
          });
        }}
        onCopyLinkChange={(enabled) => {
          setState((project) => setCopyLinking(project, enabled, project.device));
          toast.success(enabled ? "Copy linked across devices" : "Copy continuity off", {
            description: enabled
              ? "Matching screen positions now update together across device decks."
              : "Each device deck can now use independent copy.",
          });
        }}
        onApplyAiProposal={(proposal) => {
          setState((project) => {
            const next = applyAiProposal(project, proposal, project.locale, project.device);
            return project.copySync?.enabled
              ? setCopyLinking(next, true, project.device)
              : next;
          });
          toast.success("AI suggestions applied", {
            description: "Only localized copy changed. Your captures, layout and export settings stayed intact.",
          });
        }}
        validation={validation}
      />

      <div className="flex flex-1 overflow-hidden md:flex-row flex-col">
        <aside className="store-sidebar md:w-72 w-full shrink-0 border-r md:max-h-none max-h-64 overflow-hidden">
          <Sidebar
            slides={currentSlides}
            activeId={activeSlide?.id || null}
            device={state.device}
            orientation={state.orientation}
            theme={theme}
            locale={state.locale}
            appName={state.appName}
            appIcon={state.appIcon}
            assets={assetLibrary}
            connectedCanvas={state.connectedCanvas}
            disabled={busy}
            onReorder={reorderSlides}
            onSelect={setActiveSlideId}
            onDelete={deleteSlide}
            onDuplicate={duplicateSlide}
            onAdd={addSlide}
          />
        </aside>

        <main className="flex flex-1 items-stretch overflow-hidden min-h-0">
          {activeSlide && currentSlides.length > 0 ? (
            <PreviewStage
              slides={currentSlides}
              activeSlideId={activeSlide.id}
              device={state.device}
              orientation={state.orientation}
              theme={theme}
              locale={state.locale}
              appName={state.appName}
              appIcon={state.appIcon}
              assets={assetLibrary}
              connectedCanvas={state.connectedCanvas}
              selectedElement={selectedElement}
              onActiveSlideChange={setActiveSlideId}
              onLabelChange={(slide, v) => patchLocalized(slide, "label", v)}
              onHeadlineChange={(slide, v) => patchLocalized(slide, "headline", v)}
              onTextElementTextChange={patchTextElementText}
              onElementChange={patchElementTransform}
              onSelectElement={setSelectedElement}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">No screen selected</p>
              <p>Add a screen on the left to get started.</p>
            </div>
          )}
        </main>

        <aside className="store-sidebar md:w-80 w-full shrink-0 border-l md:max-h-none max-h-96 overflow-hidden">
          {activeSlide ? (
            <Inspector
              slide={activeSlide}
              device={state.device}
              orientation={state.orientation}
              locale={state.locale}
              selectedElementId={
                selectedElement?.slideId === activeSlide.id ? selectedElement.elementId : null
              }
              onChange={(patch) => patchSlide(activeSlide.id, patch)}
              onLocalizedChange={(key, value) => patchLocalized(activeSlide, key, value)}
              assets={assetLibrary}
              onAssetLibraryChange={(assets) => setState((p) => ({ ...p, assets }))}
              maxArtworkSpan={maxArtworkSpan}
              artworkTonePattern={artworkTonePattern}
              onSelectElement={(elementId) =>
                setSelectedElement(
                  elementId ? { slideId: activeSlide.id, elementId } : null,
                )
              }
            />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 p-6 text-center text-sm text-muted-foreground">
              <p className="font-medium text-foreground">Nothing to inspect</p>
              <p className="text-xs">Screen settings will appear here once you add or select one.</p>
            </div>
          )}
        </aside>
      </div>

      {/* Off-screen export container — full-resolution canvases for html-to-image. */}
      <div
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        {currentSlides.length > 0 && (
          <div
            ref={exportRef}
            style={{
              width: cW,
              height: cH,
              overflow: "hidden",
              position: "absolute",
              left: -99999,
              top: 0,
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -exportSlideIndex * cW,
                top: 0,
                width: cW * currentSlides.length,
                height: cH,
              }}
            >
              <DeckCanvas
                slides={currentSlides}
                device={state.device}
                orientation={state.orientation}
                theme={theme}
                locale={exportLocaleOverride ?? state.locale}
                appName={state.appName}
                appIcon={state.appIcon}
                assets={assetLibrary}
                connectedCanvas={state.connectedCanvas}
                hideEmpty
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function slugify(s: string) {
  return (
    s
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "") || "screenshots"
  );
}

function slideNeedsScreenshot(device: Device, slide: Slide) {
  if (device === "feature-graphic") return false;
  return slide.layout !== "no-device" && slide.layout !== "feature-graphic";
}

function stamp() {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}
