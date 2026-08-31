import { z } from "zod";

const DeviceSchema = z.enum(["iphone", "ipad", "android", "android-7", "android-10", "feature-graphic"]);
const LayoutSchema = z.enum(["hero", "device-bottom", "device-top", "two-devices", "no-device", "split-landscape", "feature-graphic"]);
const LocalizedTextSchema = z.union([z.string(), z.record(z.string(), z.string())]);
const TransformSchema = z.object({
  x: z.number().finite(),
  y: z.number().finite(),
  width: z.number().finite().positive(),
  height: z.number().finite().positive(),
  rotation: z.number().finite().optional(),
  zIndex: z.number().finite().optional(),
}).passthrough();
const SlotSpanSchema = z.union([z.literal(1), z.literal(2), z.literal(3)]);
const DevicePresentationSchema = z.object({
  preset: z.enum(["flat", "tilt-left", "tilt-right", "low-angle", "high-angle", "custom"]),
  rotateX: z.number().finite().min(-45).max(45),
  rotateY: z.number().finite().min(-60).max(60),
  perspective: z.number().finite().min(400).max(4000),
  depth: z.number().finite().min(0).max(48),
});
const DeviceSlotSchema = z.object({
  id: z.string().trim().min(1),
  screenshot: z.string(),
  assetRef: z.string().trim().min(1).optional(),
  transform: TransformSchema,
  presentation: DevicePresentationSchema.optional(),
  spanSlots: SlotSpanSchema.optional(),
  opacity: z.number().finite().min(0).max(1).optional(),
});
const ConstraintSchema = z.object({
  x: z.object({ anchor: z.string().optional(), value: z.number().finite().optional(), offset: z.number().finite().optional(), unit: z.enum(["px", "percent"]).optional() }).optional(),
  y: z.object({ anchor: z.string().optional(), value: z.number().finite().optional(), offset: z.number().finite().optional(), unit: z.enum(["px", "percent"]).optional() }).optional(),
  width: z.object({ value: z.number().finite().positive(), unit: z.enum(["px", "percent"]) }).optional(),
  height: z.object({ value: z.number().finite().positive(), unit: z.enum(["px", "percent"]) }).optional(),
  maxWidth: z.number().finite().positive().optional(),
  maxHeight: z.number().finite().positive().optional(),
}).passthrough();
const TextElementSchema = z.object({
  id: z.string().min(1),
  text: z.union([z.string(), z.record(z.string(), z.string())]),
  transform: TransformSchema,
  fontSize: z.number().finite().positive().optional(),
  fontWeight: z.number().finite().positive().optional(),
  color: z.string().optional(),
  align: z.enum(["left", "center", "right"]).optional(),
}).passthrough();
const AssetSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["screen", "component", "image"]),
  label: z.string().optional(),
  platform: z.enum(["ios", "android"]).optional(),
  paths: z.record(z.string(), z.string()),
  source: z.object({ adapter: z.string().optional(), captureId: z.string().optional(), updatedAt: z.string().optional() }).optional(),
}).passthrough();

export const SlideSchema = z.object({
  id: z.string().min(1),
  layout: LayoutSchema,
  label: LocalizedTextSchema,
  headline: LocalizedTextSchema,
  screenshot: z.string(),
  screenshotSecondary: z.string().optional(),
  assetRef: z.string().min(1).optional(),
  assetRefSecondary: z.string().min(1).optional(),
  deviceSlots: z.array(DeviceSlotSchema).optional(),
  presentations: z.object({
    device: DevicePresentationSchema.optional(),
    deviceSecondary: DevicePresentationSchema.optional(),
  }).optional(),
  captionSpan: SlotSpanSchema.optional(),
  copyKey: z.string().trim().min(1).optional(),
  inverted: z.boolean().optional(),
  transforms: z.record(z.string(), TransformSchema).optional(),
  textElements: z.array(TextElementSchema).optional(),
  constraints: z.record(z.string(), ConstraintSchema).optional(),
  responsive: z.record(z.string(), z.record(z.string(), ConstraintSchema)).optional(),
  hiddenElements: z.array(z.string()).optional(),
  lockedElements: z.array(z.string()).optional(),
}).passthrough();

export const ProjectStateSchema = z.object({
  schemaVersion: z.number().int().positive().optional(),
  appName: z.string().trim().min(1),
  themeId: z.string().trim().min(1),
  templateId: z.string().trim().min(1).optional(),
  paletteId: z.string().trim().min(1).optional(),
  copySync: z.object({
    enabled: z.boolean(),
    sourceDevice: DeviceSchema,
    matchBy: z.literal("copyKey-or-index"),
  }).optional(),
  connectedCanvas: z.boolean(),
  locales: z.array(z.string().trim().min(1)).min(1),
  locale: z.string().trim().min(1),
  device: DeviceSchema,
  orientation: z.enum(["portrait", "landscape"]),
  slidesByDevice: z.record(z.string(), z.array(SlideSchema)),
  appIcon: z.string().optional(),
  assets: z.record(z.string(), AssetSchema).optional(),
  brand: z.object({
    colors: z.record(z.string(), z.string()).optional(),
    typography: z.record(z.string(), z.unknown()).optional(),
    radius: z.record(z.string(), z.number().finite()).optional(),
    effects: z.record(z.string(), z.string()).optional(),
  }).passthrough().optional(),
}).passthrough();

export type ProjectStateInput = z.infer<typeof ProjectStateSchema>;
