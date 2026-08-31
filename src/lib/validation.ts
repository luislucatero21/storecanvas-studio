import { getExportSizes } from "./constants";
import { assetRefsInProject } from "./asset-library";
import { resolveAssetPath } from "./asset-library";
import { ProjectStateSchema } from "./schema";
import type { Device, ProjectState, Slide } from "./types";

export type ValidationIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  slideId?: string;
  locale?: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
  issues: ValidationIssue[];
};

function needsScreenshot(device: Device, slide: Slide) {
  return device !== "feature-graphic" && slide.layout !== "no-device" && slide.layout !== "feature-graphic";
}

function severity(strict: boolean): "error" | "warning" {
  return strict ? "error" : "warning";
}

export function validateProject(
  input: unknown,
  options: { strict?: boolean; existingPaths?: Set<string> } = {},
): ValidationResult {
  const strict = options.strict ?? false;
  const parsed = ProjectStateSchema.safeParse(input);
  if (!parsed.success) {
    const issues: ValidationIssue[] = parsed.error.issues.map((issue) => ({
      code: "schema-invalid",
      severity: "error",
      message: `${issue.path.join(".") || "project"}: ${issue.message}`,
    }));
    return { valid: false, errors: issues, warnings: [], issues };
  }
  const project = parsed.data as ProjectState;
  const issues: ValidationIssue[] = [];
  const refs = new Set(assetRefsInProject(project));

  if (!project.locales.includes(project.locale)) {
    issues.push({ code: "locale-not-configured", severity: "error", message: `Active locale ${project.locale} is not configured.` });
  }

  for (const [device, slides] of Object.entries(project.slidesByDevice) as [Device, Slide[]][]) {
    const maxSlides = device === "iphone" || device === "ipad" ? 10 : 8;
    if (slides.length > maxSlides) {
      issues.push({ code: "slide-limit", severity: "error", message: `${device} has ${slides.length} slides; the store limit is ${maxSlides}.` });
    }
    if (!getExportSizes(device, device === "android-7" || device === "android-10" ? project.orientation : "portrait").length) {
      issues.push({ code: "no-export-target", severity: "error", message: `No export target is configured for ${device}.` });
    }
    slides.forEach((slide, slideIndex) => {
      if (needsScreenshot(device, slide)) {
        if (slide.assetRef && !project.assets?.[slide.assetRef] && !slide.screenshot) {
          issues.push({ code: "unresolved-asset", severity: "error", message: `Asset ${slide.assetRef} is not defined.`, slideId: slide.id });
        }
        const resolved = resolveAssetPath(slide.assetRef, project.locale, project.assets, slide.screenshot);
        if (!resolved) {
          issues.push({ code: "missing-screenshot", severity: severity(strict), message: "Add a screenshot or semantic capture before exporting.", slideId: slide.id, locale: project.locale });
        } else if (options.existingPaths && !resolved.startsWith("data:") && !options.existingPaths.has(resolved)) {
          issues.push({ code: "missing-file", severity: severity(strict), message: `Screenshot file is missing at ${resolved}.`, slideId: slide.id, locale: project.locale });
        }
      }
      for (const ref of [slide.assetRef, slide.assetRefSecondary]) {
        if (ref && !project.assets?.[ref] && !slide.screenshot && !slide.screenshotSecondary) {
          refs.add(ref);
        }
      }
      for (const slot of slide.deviceSlots || []) {
        const resolved = resolveAssetPath(slot.assetRef, project.locale, project.assets, slot.screenshot);
        if (!resolved) {
          issues.push({ code: "missing-slot-screenshot", severity: severity(strict), message: "Add a capture to every extra device slot before exporting.", slideId: slide.id, locale: project.locale });
        } else if (options.existingPaths && !resolved.startsWith("data:") && !options.existingPaths.has(resolved)) {
          issues.push({ code: "missing-slot-file", severity: severity(strict), message: `Extra device capture is missing at ${resolved}.`, slideId: slide.id, locale: project.locale });
        }
      }
      for (const artwork of slide.connectedArtworks || []) {
        const resolved = resolveAssetPath(artwork.assetRef, project.locale, project.assets, artwork.image);
        if (!resolved) {
          issues.push({ code: "missing-connected-artwork", severity: severity(strict), message: "Add an image to every connected artwork before exporting.", slideId: slide.id, locale: project.locale });
        } else if (options.existingPaths && !resolved.startsWith("data:") && !options.existingPaths.has(resolved)) {
          issues.push({ code: "missing-connected-artwork-file", severity: severity(strict), message: `Connected artwork is missing at ${resolved}.`, slideId: slide.id, locale: project.locale });
        }
        if (slideIndex + artwork.spanSlots > slides.length) {
          issues.push({ code: "connected-artwork-overflow", severity: "error", message: `Connected artwork needs ${artwork.spanSlots} screens but reaches past the end of the deck.`, slideId: slide.id });
        }
      }
    });
  }

  const errors = issues.filter((issue) => issue.severity === "error");
  const warnings = issues.filter((issue) => issue.severity === "warning");
  return { valid: errors.length === 0, errors, warnings, issues };
}
