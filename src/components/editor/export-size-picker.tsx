"use client";

import * as React from "react";
import { Check, RotateCcw, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DEVICE_LABEL, getDefaultExportSizeIds, getExportSizes, getSelectedExportSizes } from "@/lib/constants";
import type { Device, Orientation } from "@/lib/types";

type Props = {
  device: Device;
  orientation: Orientation;
  selectedIds?: string[];
  onChange: (ids: string[]) => void;
  disabled?: boolean;
};

export function ExportSizePicker({ device, orientation, selectedIds, onChange, disabled }: Props) {
  const sizes = getExportSizes(device, orientation);
  const [open, setOpen] = React.useState(false);

  // Devices with a single store target do not need another control in the
  // toolbar, but they still go through the same selected-size export path.
  if (sizes.length <= 1) return null;

  const selected = getSelectedExportSizes(
    device,
    orientation,
    selectedIds ? { [device]: selectedIds } : undefined,
  );
  const selectedIdsSet = new Set(selected.map((size) => size.id));

  function toggle(id: string) {
    const next = selectedIdsSet.has(id)
      ? selected.filter((size) => size.id !== id)
      : [...selected, sizes.find((size) => size.id === id)].filter(Boolean);
    // A zero-target export is never useful; keep the Apple default selected.
    onChange((next.length ? next : sizes.slice(0, 1)).map((size) => size!.id));
  }

  function restoreDefault() {
    onChange(getDefaultExportSizeIds(device, orientation));
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="h-8 gap-1.5 px-2 text-xs"
        aria-label={`Export sizes for ${DEVICE_LABEL[device]}`}
        title="Choose which store sizes enter the export bundle"
        onClick={() => setOpen(true)}
        disabled={disabled}
      >
        <SlidersHorizontal className="h-3.5 w-3.5" />
        {selected.length} size{selected.length === 1 ? "" : "s"}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Export sizes · {DEVICE_LABEL[device]}</DialogTitle>
            <DialogDescription>
              Choose the targets to include in this device&apos;s ZIP. New projects start with Apple&apos;s global size only.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2" role="group" aria-label={`Available export sizes for ${DEVICE_LABEL[device]}`}>
            {sizes.map((size, index) => {
              const checked = selectedIdsSet.has(size.id);
              return (
                <button
                  key={size.id}
                  type="button"
                  role="checkbox"
                  aria-checked={checked}
                  aria-label={`Export ${size.label} ${size.w}×${size.h}`}
                  data-export-size-id={size.id}
                  className={`flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-colors ${
                    checked ? "border-foreground/30 bg-muted" : "border-border hover:bg-muted/50"
                  }`}
                  onClick={() => toggle(size.id)}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-medium">{size.label}</span>
                    <span className="block text-xs text-muted-foreground">{size.w} × {size.h}</span>
                  </span>
                  <span className="ml-3 flex shrink-0 items-center gap-2">
                    {index === 0 && <span className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">Apple global</span>}
                    <span className={`flex h-5 w-5 items-center justify-center rounded border ${checked ? "border-foreground bg-foreground text-background" : "border-muted-foreground/40"}`}>
                      {checked && <Check className="h-3.5 w-3.5" />}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
          <div className="flex items-center justify-between border-t pt-3">
            <p className="text-xs text-muted-foreground">
              {selected.length} selected · canvas stays at the largest design size
            </p>
            <Button type="button" variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={restoreDefault}>
              <RotateCcw className="h-3.5 w-3.5" />
              Apple default
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
