import type {
  ElementTransform,
  LayoutConstraint,
  ResponsiveOverrides,
} from "./types";

export type CanvasSize = { w: number; h: number };

function mergeConstraint(
  base: LayoutConstraint | undefined,
  next: LayoutConstraint | undefined,
): LayoutConstraint {
  if (!next) return { ...(base || {}) };
  return {
    ...(base || {}),
    ...next,
    x: { ...(base?.x || {}), ...(next.x || {}) },
    y: { ...(base?.y || {}), ...(next.y || {}) },
    width: next.width || base?.width,
    height: next.height || base?.height,
  };
}

function valueInPixels(value: number | undefined, unit: "px" | "percent" | undefined, size: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return unit === "percent" ? value * size : value;
}

function resolveDimension(
  current: number,
  value: { value: number; unit: "px" | "percent" } | undefined,
  size: number,
) {
  if (!value) return current;
  return Math.max(1, valueInPixels(value.value, value.unit, size));
}

function resolvePosition(
  current: number,
  position: { anchor?: string; value?: number; offset?: number; unit?: "px" | "percent" } | undefined,
  canvasSize: number,
  elementSize: number,
) {
  if (!position) return current;
  const amount = valueInPixels(
    position.value ?? position.offset,
    position.unit,
    canvasSize,
  );
  switch (position.anchor) {
    case "center":
      return (canvasSize - elementSize) / 2 + amount;
    case "end":
    case "bottom":
      return canvasSize - elementSize - amount;
    case "start":
    case "top":
      return amount;
    default:
      return current + amount;
  }
}

/** Resolve one node's constraint against an output artboard. */
export function resolveResponsiveTransform({
  base,
  canvas,
  constraint,
  overrides,
}: {
  base: ElementTransform;
  canvas: CanvasSize;
  constraint?: LayoutConstraint;
  overrides?: ResponsiveOverrides;
}): ElementTransform {
  const merged = [
    constraint,
    overrides?.platform,
    overrides?.device,
    overrides?.target,
    overrides?.locale,
    overrides?.manual,
  ].reduce<LayoutConstraint>((result, item) => mergeConstraint(result, item), {});
  const width = Math.min(
    merged.maxWidth || Number.POSITIVE_INFINITY,
    resolveDimension(base.width, merged.width, canvas.w),
  );
  const heightFromWidth = merged.width && !merged.height
    ? width * (base.height / Math.max(1, base.width))
    : base.height;
  const height = Math.min(
    merged.maxHeight || Number.POSITIVE_INFINITY,
    resolveDimension(heightFromWidth, merged.height, canvas.h),
  );

  return {
    ...base,
    x: resolvePosition(base.x, merged.x, canvas.w, width),
    y: resolvePosition(base.y, merged.y, canvas.h, height),
    width,
    height,
  };
}

export function constraintFor(
  constraints: Partial<Record<string, LayoutConstraint>> | undefined,
  responsive: Partial<Record<string, ResponsiveOverrides>> | undefined,
  elementId: string,
): { constraint?: LayoutConstraint; overrides?: ResponsiveOverrides } {
  return {
    constraint: constraints?.[elementId],
    overrides: responsive?.[elementId],
  };
}
