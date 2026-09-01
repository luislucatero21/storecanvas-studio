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
import { requestArtworkImage, resolveArtworkProviderRequest } from "@/lib/artwork-ai-server";
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
import { applyDeviceAngle, createDeviceSlot, setDeviceSlotLinking, setDeviceSlotSpan } from "@/lib/device-presentation";
import { exportFileName, exportPath, slugify } from "@/lib/export-naming";
import { captionSegmentColors, captionTextGradient } from "@/lib/caption-contrast";
import { getElementTransform } from "@/components/editor/slide-canvas";
import { ProjectStateSchema } from "@/lib/schema";
import { validateProject } from "@/lib/validation";
import { isReadOnlyRuntime } from "@/lib/runtime";
import {
  isLocalPrivateProjectAvailable,
  isProjectFileConfigured,
  projectFilePath,
} from "@/lib/project-file";
import {
  createProjectId,
  emptyProjectLibrary,
  makeLocalProject,
  removeLocalProject,
  summarizeProjects,
  upsertLocalProject,
} from "@/lib/project-library";

describe("StoreCanvas project contracts", () => {
  it("recognizes read-only runtimes without requiring a database", () => {
    expect(isReadOnlyRuntime({})).toBe(false);
    expect(isReadOnlyRuntime({ VERCEL: "1" })).toBe(true);
    expect(isReadOnlyRuntime({ ["STORECANVAS_READ_ONLY"]: "1" })).toBe(true);
  });

  it("keeps the checked-in demo read-only unless file sync is opted in", () => {
    expect(isProjectFileConfigured({})).toBe(false);
    expect(isProjectFileConfigured({ ["STORECANVAS_PROJECT_FILE"]: "app-store-screenshots.json" })).toBe(true);
  });

  it("auto-discovers the ignored private project only in a local runtime", () => {
    const root = "/tmp/storecanvas-local-checkout";
    const exists = () => true;

    expect(isLocalPrivateProjectAvailable(root, {}, exists)).toBe(true);
    expect(projectFilePath(root, {}, exists)).toBe(resolve(root, "app-store-screenshots.json"));
    expect(isLocalPrivateProjectAvailable(root, { VERCEL: "1" }, exists)).toBe(false);
    expect(projectFilePath(root, { VERCEL: "1" }, exists)).toBe(resolve(root, "example-project.json"));
    expect(isLocalPrivateProjectAvailable(root, { STORECANVAS_PROJECT_FILE: "private.json" }, exists)).toBe(false);
  });

  it("keeps local projects portable and switches the active record predictably", () => {
    const first = makeLocalProject({ ...DEFAULT_PROJECT, appName: "First campaign" }, { id: "first", updatedAt: 100 });
    const second = makeLocalProject({ ...DEFAULT_PROJECT, appName: "Second campaign" }, { id: "second", updatedAt: 200 });
    const library = upsertLocalProject(upsertLocalProject(emptyProjectLibrary(), first), second);

    expect(library.activeProjectId).toBe("second");
    expect(summarizeProjects(library.projects)).toEqual([
      { id: "second", name: "Second campaign", updatedAt: 200 },
      { id: "first", name: "First campaign", updatedAt: 100 },
    ]);
    expect(createProjectId("Local campaign", 1000, 0)).toMatch(/^local-campaign-rs-0000$/);

    const remaining = removeLocalProject(library, "second");
    expect(remaining.activeProjectId).toBe("first");
    expect(remaining.projects).toHaveLength(1);
  });

  it("resolves a shared caption width once when its position is customized", () => {
    const sharedSlide = {
      ...DEFAULT_PROJECT.slidesByDevice.iphone[0],
      captionSpan: 2 as const,
    };
    const expectedWidth = 1320 * 0.84 + 1320;
    const defaultTransform = getElementTransform(sharedSlide, "iphone", "portrait", "caption");

    expect(defaultTransform?.width).toBeCloseTo(expectedWidth);

    const savedTransform = {
      x: 320,
      y: 260,
      width: 1900,
      height: 480,
      rotation: 0,
      zIndex: 4,
    };
    const customized = getElementTransform(
      { ...sharedSlide, transforms: { caption: savedTransform } },
      "iphone",
      "portrait",
      "caption",
    );

    expect(customized).toMatchObject(savedTransform);
  });

  it("assigns shared-caption text contrast per connected slot", () => {
    const colors = captionSegmentColors(
      { fg: "#161D3C", fgAlt: "#F8FBFF" },
      [false, true],
    );

    expect(colors).toEqual(["#161D3C", "#F8FBFF"]);
    expect(captionTextGradient(colors)).toBe(
      "linear-gradient(90deg, #161D3C 0%, #161D3C 50%, #F8FBFF 50%, #F8FBFF 100%)",
    );
  });

  it("ships a competitive wardrobe with at least twelve palettes and templates", () => {
    expect(PALETTE_PRESETS.length).toBeGreaterThanOrEqual(12);
    expect(CAMPAIGN_TEMPLATES.length).toBeGreaterThanOrEqual(12);
    expect(new Set(PALETTE_PRESETS.map((palette) => palette.id)).size).toBe(PALETTE_PRESETS.length);
    expect(new Set(CAMPAIGN_TEMPLATES.map((template) => template.id)).size).toBe(CAMPAIGN_TEMPLATES.length);
  });

  it("keeps every named palette readable on light and contrast surfaces", () => {
    for (const palette of PALETTE_PRESETS) {
      expect(contrastRatio(palette.colors.surface, palette.colors.ink), palette.name).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(palette.colors.surfaceAlt, palette.colors.inkAlt), palette.name).toBeGreaterThanOrEqual(4.5);
    }
  });

  it("includes self-contained demo captures for the checked-in example", () => {
    for (const name of ["overview", "plan", "focus", "progress", "insights", "settings"]) {
      const svg = readFileSync(resolve("public/screenshots/demo", `${name}.svg`), "utf8");
      expect(svg, name).toContain("<svg");
    }
    expect(readFileSync(resolve("public/backgrounds/demo-ribbon.svg"), "utf8")).toContain("<svg");
  });

  it("starts projects with an explicit campaign template and palette", () => {
    expect(DEFAULT_PROJECT).toMatchObject({
      templateId: "editorial-route",
      paletteId: "parchment-signal",
    });
  });

  it("accepts the checked-in example project", () => {
    const result = ProjectStateSchema.safeParse(JSON.parse(readFileSync(resolve("example-project.json"), "utf8")));

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
    expect(next.slidesByDevice.iphone[0].transforms).toEqual(slide.transforms);
  });

  it("only lets a template replace palette and manual placement when explicitly opted in", () => {
    const slide = {
      ...DEFAULT_PROJECT.slidesByDevice.iphone[0],
      transforms: { device: { x: 10, y: 20, width: 300, height: 610 } },
    };
    const project = {
      ...DEFAULT_PROJECT,
      paletteId: "custom",
      slidesByDevice: { ...DEFAULT_PROJECT.slidesByDevice, iphone: [slide] },
    };

    const preserved = applyCampaignTemplate(project, "afterglow-rhythm", "iphone");
    const overridden = applyCampaignTemplate(project, "afterglow-rhythm", "iphone", {
      applyRecommendedPalette: true,
      resetCustomizations: true,
    });

    expect(preserved.paletteId).toBe("custom");
    expect(preserved.slidesByDevice.iphone[0].transforms).toEqual(slide.transforms);
    expect(overridden.paletteId).toBe("afterglow-pulse");
    expect(overridden.slidesByDevice.iphone[0].transforms).toBeUndefined();
  });

  it("reflows uploaded connected artwork to the active template's two-screen seam", () => {
    const slides = DEFAULT_PROJECT.slidesByDevice.iphone.slice(0, 6).map((slide) => ({ ...slide }));
    slides[0] = {
      ...slides[0],
      connectedArtworks: [{
        id: "shared-visual",
        image: "/screenshots/uploaded/panorama.png",
        spanSlots: 2,
        transform: { x: 14, y: 20, width: 2500, height: 2868, zIndex: 1 },
      }],
    };
    const project = { ...DEFAULT_PROJECT, slidesByDevice: { ...DEFAULT_PROJECT.slidesByDevice, iphone: slides } };

    const next = applyCampaignTemplate(project, "afterglow-rhythm", "iphone");
    const startIndex = CAMPAIGN_TEMPLATES.find((item) => item.id === "afterglow-rhythm")!.connectedPairs[0].startIndex;

    expect(next.slidesByDevice.iphone[0].connectedArtworks).toBeUndefined();
    expect(next.slidesByDevice.iphone[startIndex].connectedArtworks?.[0]).toMatchObject({
      id: "shared-visual",
      image: "/screenshots/uploaded/panorama.png",
      spanSlots: 2,
      transform: { x: 0, y: 0, width: 2640, height: 2868 },
    });
  });

  it("applies a palette without discarding the project typography", () => {
    const next = applyPalette(
      {
        ...DEFAULT_PROJECT,
        brand: {
          typography: { display: { family: "Fraunces", weight: 700 } },
        },
      },
      "afterglow-pulse",
    );

    expect(next).toMatchObject({
      paletteId: "afterglow-pulse",
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
      appName: "Example app",
      locale: "en-US",
      slides: [{ id: "demo-1-route", label: "START", headline: "Own your day." }],
    });

    expect(result).toEqual({ ok: false, error: "apiKey: Add a personal API key for this provider." });
  });

  it("keeps captures and semantic links intact when an AI copy proposal is applied", () => {
    const proposal = parseAiProposal(
      '```json\n{"summary":"Sharper promise.","slides":[{"id":"demo-1-route","label":"START WITH INTENTION","headline":"Make today yours.","rationale":"It makes the benefit immediate."},{"id":"unknown","label":"IGNORE","headline":"Ignore this.","rationale":"Not in the deck."}]}\n```',
      ["demo-1-route"],
    );
    const original = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const next = applyAiProposal(
      {
        ...DEFAULT_PROJECT,
        slidesByDevice: {
          ...DEFAULT_PROJECT.slidesByDevice,
          iphone: [{ ...original, id: "demo-1-route", screenshot: "/captures/{locale}/home.png", assetRef: "capture:home-dashboard" }],
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
                content: '{"summary":"A stronger opening.","slides":[{"id":"demo-1-route","label":"TODAY","headline":"Own today.","rationale":"It is more direct."}]}',
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
        appName: "Example app",
        locale: "en-US",
        slides: [{ id: "demo-1-route", label: "START", headline: "Own your day." }],
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
      appName: "Example app",
      locale: "en-US",
      slides: [{ id: "demo-1-route", label: "START", headline: "Own your day." }],
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
    expect(slugify("Example app — App Store 2026")).toBe("example-app-app-store-2026");
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

  it("accepts supported iPhone hardware models and rejects unknown ones", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const projectWithModel = (deviceModel: string) => ({
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [{
          ...slide,
          presentations: {
            device: {
              preset: "tilt-left",
              rotateX: 2,
              rotateY: -11,
              perspective: 2100,
              depth: 9,
              deviceModel,
            },
          },
        }],
      },
    });

    expect(ProjectStateSchema.safeParse(projectWithModel("iphone-17-pro-max")).success).toBe(true);
    expect(ProjectStateSchema.safeParse(projectWithModel("iphone-future-unknown")).success).toBe(false);
  });

  it("preserves the selected hardware model when applying another camera angle", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const modeled = {
      ...slide,
      presentations: {
        device: {
          preset: "flat",
          rotateX: 0,
          rotateY: 0,
          perspective: 1400,
          depth: 0,
          deviceModel: "iphone-17-pro-max",
        },
      },
    } as unknown as typeof slide;
    const angled = applyDeviceAngle(modeled, "device", "tilt-right");

    expect((angled.presentations?.device as unknown as { deviceModel?: string }).deviceModel).toBe("iphone-17-pro-max");
  });

  it("rejects copy linking to an unsupported master device", () => {
    const result = ProjectStateSchema.safeParse({
      ...DEFAULT_PROJECT,
      copySync: { enabled: true, sourceDevice: "watch", matchBy: "index" },
    });

    expect(result.success).toBe(false);
  });

  it("keeps reused captures independent until transform linking is explicitly enabled", () => {
    const slide = DEFAULT_PROJECT.slidesByDevice.iphone[0];
    const angled = applyDeviceAngle(slide, "device", "tilt-left");
    const slot = createDeviceSlot(angled, "iphone", "portrait", "slot-one");
    const independent = setDeviceSlotSpan({ ...angled, deviceSlots: [slot] }, slot.id, 2);
    const linked = setDeviceSlotLinking(independent, slot.id, true);

    expect(angled.presentations?.device).toMatchObject({
      preset: "tilt-left",
      rotateX: 2,
      rotateY: -11,
      perspective: 2100,
      depth: 9,
    });
    expect(independent.deviceSlots?.[0]).toMatchObject({
      id: "slot-one",
      screenshot: slide.screenshot,
      assetRef: slide.assetRef,
      spanSlots: 2,
      linkedTransforms: false,
    });
    expect(linked.deviceSlots?.[0]).toMatchObject({
      spanSlots: 2,
      linkedTransforms: true,
    });
  });

  it("ships the example with independent phones, premium connected artwork and message continuity", () => {
    const project = JSON.parse(readFileSync(resolve("example-project.json"), "utf8"));
    const slides = project.slidesByDevice.iphone;
    const heroRig = slides[0].presentations?.device;
    const connectedArtwork = slides.find((slide: { connectedArtworks?: Array<{ spanSlots?: number }> }) =>
      slide.connectedArtworks?.some((artwork) => artwork.spanSlots === 2));
    const recoverySlot = slides[3].deviceSlots?.[0];
    const reflectionSlot = slides[4].deviceSlots?.[0];
    const messageSpread = slides.find((slide: { captionSpan?: number }) => slide.captionSpan === 2);

    expect(heroRig).toMatchObject({
      rotateX: 2,
      rotateY: -11,
      perspective: 2100,
      depth: 9,
      deviceModel: "iphone-17-pro-max",
    });
    expect(connectedArtwork?.connectedArtworks[0]).toMatchObject({
      id: "demo-dawn-ribbon",
      spanSlots: 2,
    });
    expect(recoverySlot).toMatchObject({ assetRef: "capture:focus", linkedTransforms: false });
    expect(reflectionSlot).toMatchObject({ assetRef: "capture:progress", linkedTransforms: false });
    expect(recoverySlot.transform).not.toEqual(reflectionSlot.transform);
    expect(messageSpread).toMatchObject({ id: "demo-8-routine", captionSpan: 2 });
  });

  it("resolves and saves a generated OpenAI artwork without persisting the personal key", async () => {
    const provider = resolveArtworkProviderRequest({
      provider: "openai",
      apiKey: "sk-private",
      model: "gpt-image-2",
      prompt: "A continuous editorial ribbon across two App Store screens",
    });
    expect(provider).toMatchObject({
      endpoint: "https://api.openai.com/v1/images/generations",
      model: "gpt-image-2",
    });

    const result = await requestArtworkImage(
      {
        provider: "openai",
        apiKey: "sk-private",
        model: "gpt-image-2",
        prompt: "A continuous editorial ribbon across two App Store screens",
      },
      {
        fetchImpl: async (_url, init) => {
          expect(String(init?.body)).not.toContain("sk-private");
          return new Response(JSON.stringify({ data: [{ b64_json: Buffer.from("image").toString("base64") }] }), {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        },
        saveDataUrl: async () => "/screenshots/uploaded/generated.png",
      },
    );

    expect(result.path).toBe("/screenshots/uploaded/generated.png");
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
