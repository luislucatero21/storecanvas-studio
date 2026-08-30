import { describe, expect, it } from "vitest";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import { resolveAssetPath, replaceAssetPath } from "@/lib/asset-library";
import { applyCampaignTemplate, applyPalette } from "@/lib/campaign-presets";
import { resolveResponsiveTransform } from "@/lib/constraints";
import { exportFileName, exportPath, slugify } from "@/lib/export-naming";
import { ProjectStateSchema } from "@/lib/schema";
import { validateProject } from "@/lib/validation";

describe("StoreCanvas project contracts", () => {
  it("starts projects with an explicit campaign template and palette", () => {
    expect(DEFAULT_PROJECT).toMatchObject({
      templateId: "editorial-route",
      paletteId: "parchment-signal",
    });
  });

  it("accepts the Rutmia-shaped starter project", () => {
    const result = ProjectStateSchema.safeParse(DEFAULT_PROJECT);

    expect(result.success).toBe(true);
  });

  it("recomposes a campaign without losing semantic captures, copy or custom text", () => {
    const slide = {
      ...DEFAULT_PROJECT.slidesByDevice.iphone[0],
      screenshot: "/captures/{locale}/home.png",
      assetRef: "capture:home-dashboard",
      label: { en: "REAL CAPTURE" },
      headline: { en: "Keep this promise." },
      transforms: { device: { x: 10, y: 10, width: 100, height: 200 } },
      textElements: [
        {
          id: "proof",
          text: { en: "10-day streak" },
          transform: { x: 8, y: 9, width: 120, height: 40 },
        },
      ],
    };
    const project = {
      ...DEFAULT_PROJECT,
      slidesByDevice: { ...DEFAULT_PROJECT.slidesByDevice, iphone: [slide] },
    };

    const next = applyCampaignTemplate(project, "afterglow-rhythm", "iphone");

    expect(next.templateId).toBe("afterglow-rhythm");
    expect(next.slidesByDevice.iphone[0]).toMatchObject({
      screenshot: "/captures/{locale}/home.png",
      assetRef: "capture:home-dashboard",
      label: { en: "REAL CAPTURE" },
      headline: { en: "Keep this promise." },
      textElements: [expect.objectContaining({ id: "proof", text: { en: "10-day streak" } })],
      layout: "hero",
    });
    expect(next.slidesByDevice.iphone[0].transforms).toBeUndefined();
  });

  it("applies a palette without discarding the project typography", () => {
    const next = applyPalette(
      {
        ...DEFAULT_PROJECT,
        brand: {
          typography: { display: { family: "Fraunces", weight: 700 } },
        },
      },
      "rutmia-afterglow",
    );

    expect(next).toMatchObject({
      paletteId: "rutmia-afterglow",
      themeId: "dark-bold",
      brand: {
        colors: { surface: "#191B27", accent: "#FFA04A" },
        typography: { display: { family: "Fraunces", weight: 700 } },
      },
    });
  });

  it("resolves a semantic asset with locale fallback before the slide path", () => {
    const path = resolveAssetPath(
      "capture:home-dashboard",
      "es-MX",
      {
        "capture:home-dashboard": {
          id: "capture:home-dashboard",
          type: "screen",
          label: "Home dashboard",
          paths: {
            en: "/screenshots/apple/iphone/{locale}/home.png",
          },
        },
      },
      "/legacy/home.png",
    );

    expect(path).toBe("/screenshots/apple/iphone/es-MX/home.png");
  });

  it("replaces one locale of a semantic asset without touching the other locales", () => {
    const next = replaceAssetPath(
      {
        "capture:home-dashboard": {
          id: "capture:home-dashboard",
          type: "screen",
          paths: { en: "/old-en.png", "es-MX": "/old-es.png" },
        },
      },
      "capture:home-dashboard",
      "es-MX",
      "/new-es.png",
    );

    expect(next["capture:home-dashboard"].paths).toEqual({
      en: "/old-en.png",
      "es-MX": "/new-es.png",
    });
  });

  it("anchors a device to the right edge at a new target size", () => {
    const resolved = resolveResponsiveTransform({
      base: { x: 100, y: 200, width: 400, height: 800, rotation: 6, zIndex: 3 },
      canvas: { w: 1200, h: 1600 },
      constraint: {
        x: { anchor: "end", offset: 48, unit: "px" },
        y: { anchor: "bottom", offset: 24, unit: "px" },
        width: { unit: "percent", value: 0.5 },
      },
    });

    expect(resolved).toEqual({
      x: 552,
      y: 376,
      width: 600,
      height: 1200,
      rotation: 6,
      zIndex: 3,
    });
  });

  it("uses the override hierarchy in base → device → locale order", () => {
    const resolved = resolveResponsiveTransform({
      base: { x: 0, y: 0, width: 300, height: 400 },
      canvas: { w: 1000, h: 1500 },
      constraint: { width: { unit: "percent", value: 0.6 } },
      overrides: {
        device: { width: { unit: "percent", value: 0.7 } },
        locale: { width: { unit: "percent", value: 0.8 } },
      },
    });

    expect(resolved.width).toBe(800);
  });

  it("gives a manual override precedence over target and locale rules", () => {
    const resolved = resolveResponsiveTransform({
      base: { x: 0, y: 0, width: 300, height: 400 },
      canvas: { w: 1000, h: 1500 },
      overrides: {
        target: { width: { unit: "percent", value: 0.6 } },
        locale: { width: { unit: "percent", value: 0.7 } },
        manual: { width: { unit: "percent", value: 0.8 } },
      },
    });

    expect(resolved.width).toBe(800);
  });

  it("creates stable, sortable export names", () => {
    expect(slugify("Rutmia — App Store 2026")).toBe("rutmia-app-store-2026");
    expect(exportFileName(1, "device-bottom")).toBe("02-device-bottom.png");
    expect(
      exportPath({
        platform: "ios",
        device: "iphone",
        width: 1320,
        height: 2868,
        locale: "es-MX",
        index: 0,
        layout: "hero",
      }),
    ).toBe("ios/iphone/1320x2868/es-MX/01-hero.png");
  });

  it("blocks strict export when a device slide has no screenshot", () => {
    const result = validateProject({
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [
          {
            ...DEFAULT_PROJECT.slidesByDevice.iphone[0],
            screenshot: "",
          },
        ],
      },
    }, { strict: true });

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "missing-screenshot")).toBe(true);
  });

  it("reports a missing static capture when a file inventory is supplied", () => {
    const result = validateProject(
      {
        ...DEFAULT_PROJECT,
        slidesByDevice: {
          ...DEFAULT_PROJECT.slidesByDevice,
          iphone: [{ ...DEFAULT_PROJECT.slidesByDevice.iphone[0], screenshot: "/missing.png" }],
        },
      },
      { strict: true, existingPaths: new Set() },
    );

    expect(result.valid).toBe(false);
    expect(result.issues.some((issue) => issue.code === "missing-file")).toBe(true);
  });

  it("rejects non-positive transform dimensions at the schema boundary", () => {
    const result = ProjectStateSchema.safeParse({
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [{ ...DEFAULT_PROJECT.slidesByDevice.iphone[0], transforms: { device: { x: 0, y: 0, width: 0, height: 100 } } }],
      },
    });

    expect(result.success).toBe(false);
  });
});
