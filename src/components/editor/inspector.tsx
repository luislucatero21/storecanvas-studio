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
  LockKeyhole,
  Plus,
  SlidersHorizontal,
  RotateCw,
  Trash2,
  Type,
  UnlockKeyhole,
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
  isBuiltInElementId,
  isTextElementId,
  textElementKey,
  toTextElementId,
} from "@/lib/elements";
import { pickText, writeLocalized } from "@/lib/locale";
import { replaceAssetPath, resolveAssetPath } from "@/lib/asset-library";
import type {
  AssetLibrary,
  BuiltInElementId,
  Device,
  ElementId,
  ElementTransform,
  LayoutConstraint,
  Orientation,
  Slide,
  SlideLayout,
  TextElement,
} from "@/lib/types";
import { ScreenshotPicker } from "./screenshot-picker";
import { getCanvas, getElementTransform } from "./slide-canvas";

type Props = {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  locale: string;
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
  assets?: AssetLibrary;
  onAssetLibraryChange?: (assets: AssetLibrary) => void;
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
  onSelectElement,
  assets,
  onAssetLibraryChange,
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
        </div>

        {!isFeatureGraphic && !isNoDevice && (
          <div className="space-y-1.5">
            <div className="space-y-1">
              <Label className="text-xs">Semantic asset ID</Label>
              <Input
                value={slide.assetRef || ""}
                onChange={(event) => setSemanticAssetRef(event.target.value)}
                placeholder="capture:home-dashboard"
                aria-label="Semantic asset ID"
              />
              <p className="text-[10px] leading-relaxed text-muted-foreground">
                Stable refs let you refresh a capture without moving the composition.
              </p>
            </div>
            <Label className="text-xs">
              {slide.layout === "two-devices" ? "Front device screenshot" : "Screenshot"}
            </Label>
            <ScreenshotPicker
              label="Primary"
              value={resolveAssetPath(slide.assetRef, locale, assets, slide.screenshot)}
              locale={locale}
              onChange={(v) => setScreenshot(v)}
            />
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

        {!isFeatureGraphic && (
          <ElementTransformControls
            slide={slide}
            device={device}
            orientation={orientation}
            locale={locale}
            selectedElementId={selectedElementId}
            onChange={onChange}
            onSelectElement={onSelectElement}
          />
        )}

        {isFeatureGraphic && (
          <p className="rounded-md border bg-muted/40 p-3 text-[11px] leading-relaxed text-muted-foreground">
            Shows app icon + name + tagline. Drop an icon at <span className="rounded bg-background px-1 py-0.5 font-mono text-[10px] text-foreground">/public/app-icon.png</span> (or leave blank — the app initial will be used). Name is set in the toolbar.
          </p>
        )}
      </div>
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
}: {
  slide: Slide;
  device: Device;
  orientation: Orientation;
  locale: string;
  selectedElementId: ElementId | null;
  onChange: (patch: Partial<Slide>) => void;
  onSelectElement: (id: ElementId | null) => void;
}) {
  const present: ElementId[] = ["caption"];
  if (slide.layout !== "no-device") present.push("device");
  if (slide.layout === "two-devices") present.push("deviceSecondary");
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
    ranked.forEach((eid, i) => {
      const cur = getTransform(eid);
      if (!cur) return;
      if (isTextElementId(eid)) {
        const textId = textElementKey(eid);
        const textElement = nextTextElements.find((element) => element.id === textId);
        if (textElement) textElement.transform = { ...textElement.transform, zIndex: i + 1 };
      } else if (isBuiltInElementId(eid)) {
        nextTransforms[eid] = { ...cur, zIndex: i + 1 };
      }
    });
    onChange({ transforms: nextTransforms, textElements: nextTextElements });
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
            onDeleteText={() => {
              if (activeTextElement) deleteTextElement(activeTextElement);
            }}
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
  transform,
  textElement,
  locale,
  onRotate,
  onReorder,
  onTextChange,
  onTextPatch,
  onDeleteText,
  hidden,
  locked,
  onToggleHidden,
  onToggleLocked,
}: {
  activeId: ElementId;
  transform: ElementTransform | undefined;
  textElement?: TextElement;
  locale: string;
  onRotate: (rotation: number) => void;
  onReorder: (dir: "front" | "back" | "up" | "down") => void;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
  onDeleteText: () => void;
  hidden: boolean;
  locked: boolean;
  onToggleHidden: () => void;
  onToggleLocked: () => void;
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

      {textElement && (
        <TextElementPanel
          element={textElement}
          locale={locale}
          onTextChange={onTextChange}
          onTextPatch={onTextPatch}
        />
      )}

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

function TextElementPanel({
  element,
  locale,
  onTextChange,
  onTextPatch,
}: {
  element: TextElement;
  locale: string;
  onTextChange: (value: string) => void;
  onTextPatch: (patch: Partial<TextElement>) => void;
}) {
  const text = element.text?.[locale] ?? pickText(element.text, locale);
  return (
    <div className="space-y-2 rounded border bg-muted/30 p-2">
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
          <Label className="text-[11px] text-muted-foreground">Size</Label>
          <Input
            type="number"
            min={12}
            max={400}
            value={Math.round(element.fontSize || 72)}
            onChange={(event) => onTextPatch({ fontSize: Number(event.target.value) || 72 })}
          />
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">Color</Label>
          <Input
            type="color"
            value={element.color || "#171717"}
            className="h-9 p-1"
            onChange={(event) => onTextPatch({ color: event.target.value })}
          />
        </div>
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
  return "Text";
}

function defaultZ(id: ElementId): number {
  if (isTextElementId(id)) return 5;
  if (id === "deviceSecondary") return 2;
  if (id === "device") return 3;
  return 4; // caption on top
}
