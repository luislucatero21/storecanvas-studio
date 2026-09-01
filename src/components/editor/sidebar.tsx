"use client";
import * as React from "react";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { ChevronDown, CircleCheck, Image, PanelLeftClose, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AssetLibrary, Device, Orientation, Slide, Theme } from "@/lib/types";
import { newSlide } from "@/lib/defaults";
import { SlideThumb } from "./slide-thumb";

type Props = {
  slides: Slide[];
  activeId: string | null;
  device: Device;
  orientation: Orientation;
  theme: Theme;
  locale: string;
  appName?: string;
  appIcon?: string;
  assets?: AssetLibrary;
  connectedCanvas: boolean;
  disabled?: boolean;
  onReorder: (next: Slide[]) => void;
  onSelect: (id: string) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onAdd: (slide: Slide) => void;
  onClosePanel?: () => void;
};

export function Sidebar({
  slides,
  activeId,
  device,
  orientation,
  theme,
  locale,
  appName,
  appIcon,
  assets,
  connectedCanvas,
  disabled,
  onReorder,
  onSelect,
  onDelete,
  onDuplicate,
  onAdd,
  onClosePanel,
}: Props) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = slides.findIndex((s) => s.id === active.id);
    const newIdx = slides.findIndex((s) => s.id === over.id);
    if (oldIdx === -1 || newIdx === -1) return;
    onReorder(arrayMove(slides, oldIdx, newIdx));
  };

  return (
    <div className="store-sidebar flex h-full flex-col">
      <div className="flex items-start justify-between gap-2 border-b p-3">
        <div className="min-w-0">
          <h2 className="store-panel-title text-sm font-semibold">Screens</h2>
          <p className="text-xs text-muted-foreground">
            {slides.length} screen{slides.length === 1 ? "" : "s"} · drag to reorder
          </p>
        </div>
        {onClosePanel ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            aria-label="Hide Screens panel"
            title="Hide Screens panel"
            onClick={onClosePanel}
          >
            <PanelLeftClose className="h-4 w-4" />
          </Button>
        ) : null}
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <SortableContext items={slides.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <div className="space-y-1.5">
              {slides.map((slide, i) => (
                <SlideThumb
                  key={slide.id}
                  slide={slide}
                  slides={slides}
                  index={i}
                  active={slide.id === activeId}
                  device={device}
                  orientation={orientation}
                  theme={theme}
                  locale={locale}
                  appName={appName}
                  appIcon={appIcon}
                  assets={assets}
                  connectedCanvas={connectedCanvas}
                  onSelect={() => onSelect(slide.id)}
                  onDelete={() => onDelete(slide.id)}
                  onDuplicate={() => onDuplicate(slide.id)}
                />
              ))}
              {slides.length === 0 && (
                <div className="rounded-lg border border-dashed p-6 text-center">
                  <p className="text-xs font-medium text-foreground">No screens yet</p>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    Click <span className="font-semibold">Add screen</span> to get started.
                  </p>
                </div>
              )}
            </div>
          </SortableContext>
        </DndContext>
      </div>

      <div className="border-t bg-card/70 px-3 py-3">
        <details className="group mb-2 rounded-md border bg-background/55">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-2.5 py-2">
            <span className="flex items-center gap-2 text-[11px] font-semibold text-foreground/80">
              <Image className="h-3.5 w-3.5" /> Captures
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal tabular-nums text-muted-foreground">
                {Object.keys(assets || {}).length}
              </span>
            </span>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
          </summary>
          <div data-testid="asset-library" className="store-scrollbar max-h-36 space-y-1 overflow-y-auto border-t p-2">
          {Object.values(assets || {}).slice(0, 8).map((asset) => (
            <div key={asset.id} className="store-asset-row flex items-center gap-2 rounded-md border bg-background/50 px-2 py-1.5">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded border bg-muted">
                <Image className="h-3 w-3 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[10px] font-medium text-foreground">{asset.id}</p>
                <p className="truncate text-[9px] text-muted-foreground">{asset.source?.captureId || asset.label || "capture"}</p>
              </div>
              <CircleCheck className="h-3 w-3 shrink-0 text-emerald-600" />
            </div>
          ))}
          {!Object.keys(assets || {}).length && <p className="text-[10px] text-muted-foreground">No semantic captures yet.</p>}
          </div>
        </details>
        <Button
          type="button"
          className="w-full"
          variant="default"
          onClick={() => onAdd(newSlide(device === "feature-graphic" ? "feature-graphic" : "device-bottom"))}
          disabled={disabled}
        >
          <Plus className="h-4 w-4" /> Add screen
        </Button>
      </div>
    </div>
  );
}
