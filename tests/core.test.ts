import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import {
  applyAiProposal,
  buildAiPrompt,
  parseAiProposal,
  validateAiRequest,
} from "@/lib/ai";
import { requestAiProposal } from "@/lib/ai-server";
import { resolveAssetPath, replaceAssetPath } from "@/lib/asset-library";
import {
  CAMPAIGN_TEMPLATES,
  PALETTE_PRESETS,
  applyCampaignTemplate,
  applyCustomColors,
  applyPalette,
} from "@/lib/campaign-presets";
import { resolveResponsiveTransform } from "@/lib/constraints";
import { setCopyLinking, writeLinkedCopy } from "@/lib/copy-sync";
import { applyDeviceAngle, createDeviceSlot, setDeviceSlotSpan } from "@/lib/device-presentation";
import { exportFileName, exportPath, slugify } from "@/lib/export-naming";
import { ProjectStateSchema } from "@/lib/schema";
import { validateProject } from "@/lib/validation";

describe("StoreCanvas project contracts", () => {
  it("ships a competitive wardrobe with at least eight palettes and templates", () => {
    expect(PALETTE_PRESETS).toHaveLength(8);
    expect(CAMPAIGN_TEMPLATES).toHaveLength(8);
    expect(new Set(PALETTE_PRESETS.map((palette) => palette.id)).size).toBe(8);
    expect(new Set(CAMPAIGN_TEMPLATES.map((template) => template.id)).size).toBe(8);
  });

  it("keeps every named palette readable on light and contrast surfaces", () => {
    for (const palette of PALETTE_PRESETS) {
      expect(contrastRatio(palette.colors.surface, palette.colors.ink), palette.name).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.colors.surfaceAlt, palette.colors.inkAlt), palette.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("includes exact-size native iPad captures for both Rutmia locales", () => {
    for (const locale of ["en-US", "es-MX"]) {
      for (const name of ["home", "coach", "goals", "insights", "settings", "lifetime"]) {
        const png = readFileSync(resolve("public/screenshots/apple/ipad", locale, `${name}.png`));
        expect(png.readUInt32BE(16), `${locale}/${name} width`).toBe(2064);
        expect(png.readUInt32BE(20), `${locale}/${name} height`).toBe(2752);
      }
    }
  });

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

  it("applies custom colors without discarding captures, layouts or typography", () => {
    const project = {
      ...DEFAULT_PROJECT,
      brand: {
        ...DEFAULT_PROJECT.brand,
        typography: { display: { family: "Fraunces", weight: 700 } },
      },
    };
    const next = applyCustomColors(project, { accent: "#2F6BFF", surface: "#FAF7F0" });

    expect(next.paletteId).toBe("custom");
    expect(next.brand).toMatchObject({
      colors: { accent: "#2F6BFF", surface: "#FAF7F0" },
      typography: project.brand.typography,
    });
    expect(next.slidesByDevice).toEqual(project.slidesByDevice);
  });

  it("requires a personal key for BYO AI providers", () => {
    const result = validateAiRequest({
      provider: "openai",
      model: "gpt-4.1-mini",
      mode: "polish",
      appName: "Rutmia",
      locale: "en-US",
      slides: [{ id: "rutmia-1-route", label: "START", headline: "Own your day." }],
    });

    expect(result).toEqual({ ok: false, error: "apiKey: Add a personal API key for this provider." });
  });

  it("keeps captures and semantic links intact when an AI copy proposal is applied", () => {
    const proposal = parseAiProposal(
      '```json\n{"summary":"Sharper promise.","slides":[{"id":"rutmia-1-route","label":"START WITH INTENTION","headline":"Make today yours.","rationale":"It makes the benefit immediate."},{"id":"unknown","label":"IGNORE","headline":"Ignore this.","rationale":"Not in the deck."}]}\n```',
      ["rutmia-1-route"],
    );
    const original = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const next = applyAiProposal(
      {
        ...DEFAULT_PROJECT,
        slidesByDevice: {
          ...DEFAULT_PROJECT.slidesByDevice,
          iphone: [{ ...original, id: "rutmia-1-route", screenshot: "/captures/{locale}/home.png", assetRef: "capture:home-dashboard" }],
        },
      },
      proposal,
      "en",
      "iphone",
    );

    expect(next.slidesByDevice.iphone[0]).toMatchObject({
      label: { en: "START WITH INTENTION" },
      headline: { en: "Make today yours." },
      screenshot: "/captures/{locale}/home.png",
      assetRef: "capture:home-dashboard",
    });
  });

  it("forwards a text-only campaign brief through the OpenRouter-compatible route", async () => {
    let endpoint = "";
    let init: RequestInit | undefined;
    const fetchImpl = (async (input: RequestInfo | URL, options?: RequestInit) => {
      endpoint = String(input);
      init = options;
      return new Response(
        JSON.stringify({
          choices: [
            {
              message: {
                content: '{"summary":"A stronger opening.","slides":[{"id":"rutmia-1-route","label":"TODAY","headline":"Own today.","rationale":"It is more direct."}]}',
              },
            },
          ],
        }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }) as typeof fetch;

    const proposal = await requestAiProposal(
      {
        provider: "openrouter",
        apiKey: "sk-or-v1-example-key",
        model: "openai/gpt-4o-mini",
        mode: "polish",
        appName: "Rutmia",
        locale: "en-US",
        slides: [{ id: "rutmia-1-route", label: "START", headline: "Own your day." }],
      },
      { fetchImpl, env: { STORECANVAS_PUBLIC_URL: "https://storecanvas.example" } },
    );

    expect(endpoint).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(init?.headers).toMatchObject({
      Authorization: "Bearer sk-or-v1-example-key",
      "HTTP-Referer": "https://storecanvas.example",
      "X-OpenRouter-Title": "StoreCanvas",
    });
    const requestBody = JSON.stringify(init?.body);
    expect(requestBody).toContain("Own your day.");
    expect(requestBody).not.toContain("sk-or-v1-example-key");
    expect(buildAiPrompt({
      provider: "openrouter",
      apiKey: "sk-or-v1-example-key",
      model: "openai/gpt-4o-mini",
      mode: "polish",
      appName: "Rutmia",
      locale: "en-US",
      slides: [{ id: "rutmia-1-route", label: "START", headline: "Own your day." }],
    })).not.toContain("sk-or-v1-example-key");
    expect(proposal.slides[0].headline).toBe("Own today.");
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

  it("blocks export when an extra device slot points at a missing capture", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const result = validateProject({
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [{
          ...slide,
          screenshot: "/primary.png",
          deviceSlots: [{
            id: "proof-slot",
            screenshot: "/missing-slot.png",
            transform: { x: 20, y: 30, width: 300, height: 600 },
          }],
        }],
      },
    }, { strict: true, existingPaths: new Set(["/primary.png"]) });

    expect(result.issues.some((issue) => issue.code === "missing-slot-file")).toBe(true);
    expect(result.valid).toBe(false);
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

  it("rejects unsafe 3D rigs, invalid extra device slots and spans beyond three screens", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const result = ProjectStateSchema.safeParse({
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [{
          ...slide,
          captionSpan: 4,
          deviceSlots: [{ id: "", screenshot: slide.screenshot, transform: { x: 0, y: 0, width: 100, height: 200 } }],
          presentations: {
            device: { preset: "custom", rotateX: 0, rotateY: 200, perspective: 100, depth: 80 },
          },
        }],
      },
    });

    expect(result.success).toBe(false);
  });

  it("rejects copy linking to an unsupported master device", () => {
    const result = ProjectStateSchema.safeParse({
      ...DEFAULT_PROJECT,
      copySync: { enabled: true, sourceDevice: "watch", matchBy: "index" },
    });

    expect(result.success).toBe(false);
  });

  it("applies a 3D angle and duplicates the same capture into a reusable device slot", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const angled = applyDeviceAngle(slide, "device", "tilt-left");
    const slot = createDeviceSlot(angled, "iphone", "portrait", "slot-one");
    const withSlot = setDeviceSlotSpan({ ...angled, deviceSlots: [slot] }, slot.id, 2);

    expect(angled.presentations?.device).toMatchObject({
      preset: "tilt-left",
      rotateX: 2,
      rotateY: -11,
      perspective: 2100,
      depth: 9,
    });
    expect(withSlot.deviceSlots?.[0]).toMatchObject({
      id: "slot-one",
      screenshot: slide.screenshot,
      assetRef: slide.assetRef,
      spanSlots: 2,
    });
  });

  it("ships Rutmia with restrained rotation plus capture and message spreads", () => {
    const project = JSON.parse(readFileSync(resolve("app-store-screenshots.json"), "utf8"));
    const slides = project.slidesByDevice.iphone;
    const heroRig = slides[0].presentations?.device;
    const captureSpread = slides.find((slide: { deviceSlots?: Array<{ spanSlots?: number }> }) =>
      slide.deviceSlots?.some((slot) => slot.spanSlots === 2));
    const messageSpread = slides.find((slide: { captionSpan?: number }) => slide.captionSpan === 2);

    expect(heroRig).toMatchObject({ rotateX: 2, rotateY: -11, perspective: 2100, depth: 9 });
    expect(captureSpread?.deviceSlots[0]).toMatchObject({
      id: "rutmia-recovery-continuity",
      assetRef: "capture:recovery-paused",
      spanSlots: 2,
    });
    expect(messageSpread).toMatchObject({ id: "rutmia-8-routine", captionSpan: 2 });
  });

  it("propagates localized copy by screen order only while linking is enabled", () => {
    const iphone = DEFAULT_PROJECT.slidesByDevice.iphone.slice(0, 1);
    const ipad = [{ ...iphone[0], id: "ipad-first", headline: { "en-US": "Tablet copy" } }];
    const project = {
      ...DEFAULT_PROJECT,
      slidesByDevice: { ...DEFAULT_PROJECT.slidesByDevice, iphone, ipad },
    };
    const linked = setCopyLinking(project, true, "iphone");
    const updated = writeLinkedCopy(linked, "iphone", iphone[0].id, "headline", "es-MX", "Una promesa.");
    const unlinked = setCopyLinking(updated, false, "iphone");
    const localOnly = writeLinkedCopy(unlinked, "iphone", iphone[0].id, "headline", "en-US", "Only here.");

    expect(linked.slidesByDevice.ipad[0].headline).toEqual(iphone[0].headline);
    expect(updated.slidesByDevice.iphone[0].headline["es-MX"]).toBe("Una promesa.");
    expect(updated.slidesByDevice.ipad[0].headline["es-MX"]).toBe("Una promesa.");
    expect(localOnly.slidesByDevice.ipad[0].headline["en-US"]).not.toBe("Only here.");
  });
});

function contrastRatio(first: string, second: string) {
  const luminance = (hex: string) => {
    const channels = [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255);
    return channels.reduce((total, channel, index) => {
      const linear = channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
      return total + linear * [0.2126, 0.7152, 0.0722][index];
    }, 0);
  };
  const light = Math.max(luminance(first), luminance(second));
  const dark = Math.min(luminance(first), luminance(second));
  return (light + 0.05) / (dark + 0.05);
}
