import { describe, expect, it } from "vitest";
import { POST, GET } from "@/app/api/agent/route";
import {
  applyAgentTemplate,
  assertConnectedArtworkRange,
  closestId,
  editAgentScreen,
  setAgentProject,
  removeAgentElement,
  summarizeProject,
  tonePatternForProject,
  upsertGeneratedArtwork,
} from "@/lib/agent-workflow";
import { DEFAULT_PROJECT } from "@/lib/defaults";
import { CHECKED_IN_EXAMPLE_PROJECT } from "@/lib/project-file";

describe("StoreCanvas agent workflow", () => {
  it("exposes the same templates and palettes used by the editor", async () => {
    const response = await GET(new Request("http://localhost/api/agent?view=catalog"));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.ok).toBe(true);
    expect(payload.capabilities.maxArtworkSlots).toBe(10);
    expect(payload.capabilities.removeElement).toBe(true);
    expect(payload.templates.some((template: { id: string }) => template.id === "afterglow-rhythm")).toBe(true);
    expect(payload.palettes.some((palette: { id: string }) => palette.id === "afterglow-pulse")).toBe(true);
  });

  it("applies a template through the agent HTTP contract", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "apply-template",
        project: DEFAULT_PROJECT,
        device: "iphone",
        templateId: "afterglow-rhythm",
        applyRecommendedPalette: true,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state).toMatchObject({
      templateId: "afterglow-rhythm",
      paletteId: "afterglow-pulse",
      themeId: "dark-bold",
    });
  });

  it("hydrates the checked-in story for every supported phone and tablet deck", async () => {
    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "inspect", project: CHECKED_IN_EXAMPLE_PROJECT }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.state.slidesByDevice.iphone).toHaveLength(10);
    expect(payload.state.slidesByDevice.ipad).toHaveLength(10);
    expect(payload.state.slidesByDevice.android).toHaveLength(8);
    expect(payload.state.slidesByDevice["android-7"]).toHaveLength(8);
    expect(payload.state.slidesByDevice["android-10"]).toHaveLength(8);
  });

  it("plans a ten-screen artwork with inferred template tone rhythm", () => {
    const project = {
      ...CHECKED_IN_EXAMPLE_PROJECT,
      slidesByDevice: {
        ...CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice,
        iphone: CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice.iphone.map((slide, index) => ({
          ...slide,
          inverted: [1, 4, 6, 8].includes(index),
        })),
      },
    };

    expect(tonePatternForProject(project, "iphone", 0, 10)).toEqual([
      "light",
      "dark",
      "light",
      "light",
      "dark",
      "light",
      "dark",
      "light",
      "dark",
      "light",
    ]);
  });

  it("upserts generated artwork across the requested slots without moving another artwork", () => {
    const original = upsertGeneratedArtwork(CHECKED_IN_EXAMPLE_PROJECT, {
      device: "iphone",
      startIndex: 0,
      spanSlots: 2,
      image: "/screenshots/uploaded/old.png",
      artworkId: "ai-panorama",
    });
    const next = upsertGeneratedArtwork(original, {
      device: "iphone",
      startIndex: 0,
      spanSlots: 10,
      image: "/screenshots/uploaded/new.png",
      artworkId: "ai-panorama",
    });

    expect(next.slidesByDevice.iphone[0].connectedArtworks?.find((artwork) => artwork.id === "ai-panorama")).toMatchObject({
      id: "ai-panorama",
      assetRef: "image:ai-panorama",
      spanSlots: 10,
      image: "/screenshots/uploaded/new.png",
      transform: { x: 0, y: 0, width: 13200, height: 2868 },
    });
    expect(next.slidesByDevice.iphone.slice(1).every((slide) => !slide.connectedArtworks?.some((artwork) => artwork.id === "ai-panorama"))).toBe(true);
    expect(summarizeProject(next).decks.iphone.connectedArtworks.find((artwork) => artwork.id === "ai-panorama")).toMatchObject({
      id: "ai-panorama",
      startSlot: 1,
      spanSlots: 10,
    });
  });

  it("blocks artwork ranges that would reach beyond the deck", () => {
    expect(() => assertConnectedArtworkRange(DEFAULT_PROJECT, "iphone", 1, 10)).toThrow(
      "exceeds the iphone deck",
    );
  });

  it("removes user layers and hides layout-owned layers through the agent contract", async () => {
    const project = {
      ...DEFAULT_PROJECT,
      slidesByDevice: {
        ...DEFAULT_PROJECT.slidesByDevice,
        iphone: [{
          ...DEFAULT_PROJECT.slidesByDevice.iphone[0],
          textElements: [{
            id: "privacy-note",
            text: { "en-US": "Private by design" },
            transform: { x: 80, y: 120, width: 420, height: 80 },
          }],
        }],
      },
    };
    const removed = removeAgentElement(project, {
      device: "iphone",
      elementId: "text:privacy-note",
      screenIndex: 0,
    });

    expect(removed.action).toBe("removed");
    expect(removed.state.slidesByDevice.iphone[0].textElements).toBeUndefined();

    const response = await POST(new Request("http://localhost/api/agent", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "remove-element",
        project,
        device: "iphone",
        elementId: "caption",
        screenIndex: 0,
      }),
    }));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.action).toBe("remove-element");
    expect(payload.state.slidesByDevice.iphone[0].hiddenElements).toContain("caption");
  });

  describe("editAgentScreen", () => {
    const iphone = CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice.iphone;

    it("writes localized copy for the requested locale only", () => {
      const project = { ...CHECKED_IN_EXAMPLE_PROJECT, locales: ["en-US", "es"] };
      const { state, changes } = editAgentScreen(project, {
        device: "iphone", screenIndex: 1, locale: "es", headline: "Hola", label: "Etiqueta",
      });
      expect(changes).toEqual(["headline", "label"]);
      expect(state.slidesByDevice.iphone[1].headline).toMatchObject({ es: "Hola", "en-US": iphone[1].headline["en-US"] });
      expect(state.slidesByDevice.iphone[1].label.es).toBe("Etiqueta");
      expect(state.slidesByDevice.iphone[0]).toBe(iphone[0]);
    });

    it("propagates copy to the matching screen on other decks only when copy is linked", () => {
      const base = {
        ...CHECKED_IN_EXAMPLE_PROJECT,
        slidesByDevice: {
          ...CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice,
          ipad: iphone.map((slide) => ({ ...slide, id: `ipad-${slide.id}` })),
        },
      };
      const unlinked = editAgentScreen({ ...base, copySync: undefined }, {
        device: "iphone", screenIndex: 2, headline: "Linked?",
      });
      expect(unlinked.state.slidesByDevice.ipad[2].headline).toEqual(base.slidesByDevice.ipad[2].headline);

      const linked = editAgentScreen(
        { ...base, copySync: { enabled: true, sourceDevice: "iphone", matchBy: "copyKey-or-index" } },
        { device: "iphone", screenIndex: 2, headline: "Linked!" },
      );
      expect(linked.state.slidesByDevice.ipad[2].headline["en-US"]).toBe("Linked!");
    });

    it("resets transforms on layout change and rejects unknown layouts", () => {
      const project = {
        ...CHECKED_IN_EXAMPLE_PROJECT,
        slidesByDevice: {
          ...CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice,
          iphone: iphone.map((slide, index) => index === 0
            ? { ...slide, transforms: { caption: { x: 1, y: 2, width: 3, height: 4 } } }
            : slide),
        },
      };
      const { state } = editAgentScreen(project, { device: "iphone", screenIndex: 0, layout: "two-devices" });
      expect(state.slidesByDevice.iphone[0]).toMatchObject({ layout: "two-devices", screenshotSecondary: iphone[0].screenshot });
      expect(state.slidesByDevice.iphone[0].transforms).toBeUndefined();
      expect(() => editAgentScreen(project, { device: "iphone", screenIndex: 0, layout: "wide" })).toThrow(/Valid layouts: hero/);
    });

    it("updates the semantic asset path for the locale when swapping a screenshot", () => {
      const project = {
        ...CHECKED_IN_EXAMPLE_PROJECT,
        assets: {},
        slidesByDevice: {
          ...CHECKED_IN_EXAMPLE_PROJECT.slidesByDevice,
          iphone: iphone.map((slide, index) => index === 0 ? { ...slide, assetRef: "capture:home" } : slide),
        },
      };
      const { state } = editAgentScreen(project, {
        device: "iphone", screenIndex: 0, screenshot: "/screenshots/uploaded/new.png",
      });
      expect(state.slidesByDevice.iphone[0].screenshot).toBe("/screenshots/uploaded/new.png");
      expect(state.assets?.["capture:home"].paths["en-US"]).toBe("/screenshots/uploaded/new.png");
    });

    it("validates locale, screen index and the presence of a change", () => {
      expect(() => editAgentScreen(CHECKED_IN_EXAMPLE_PROJECT, { device: "iphone", screenIndex: 0, locale: "xx", headline: "x" })).toThrow(/Project locales: en-US/);
      expect(() => editAgentScreen(CHECKED_IN_EXAMPLE_PROJECT, { device: "iphone", screenIndex: 99, headline: "x" })).toThrow(/from 1 to 10/);
      expect(() => editAgentScreen(CHECKED_IN_EXAMPLE_PROJECT, { device: "iphone", screenIndex: 0 })).toThrow(/Nothing to change/);
    });

    it("is exposed as the edit-screen bridge action", async () => {
      const response = await POST(new Request("http://localhost/api/agent", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "edit-screen", project: CHECKED_IN_EXAMPLE_PROJECT, screenIndex: 0, headline: "Bridge" }),
      }));
      const payload = await response.json();
      expect(response.status).toBe(200);
      expect(payload.state.slidesByDevice.iphone[0].headline["en-US"]).toBe("Bridge");
      expect(payload.changes).toEqual(["headline"]);
    });
  });

  describe("setAgentProject", () => {
    it("switches device, orientation, app name and connected canvas", () => {
      const { state, changes } = setAgentProject(CHECKED_IN_EXAMPLE_PROJECT, {
        device: "ipad", orientation: "landscape", appName: " Renamed ", connectedCanvas: false,
      });
      expect(state).toMatchObject({ device: "ipad", orientation: "landscape", appName: "Renamed", connectedCanvas: false });
      expect(changes).toEqual(["device", "orientation", "appName", "connectedCanvas"]);
    });

    it("rejects landscape on unsupported devices, unknown locales and unknown palettes", () => {
      expect(() => setAgentProject(CHECKED_IN_EXAMPLE_PROJECT, { device: "android", orientation: "landscape" })).toThrow(/does not support landscape/);
      expect(() => setAgentProject(CHECKED_IN_EXAMPLE_PROJECT, { locale: "fr" })).toThrow(/Project locales/);
      expect(() => setAgentProject(CHECKED_IN_EXAMPLE_PROJECT, { paletteId: "afterglow-pulze" })).toThrow(/Did you mean afterglow-pulse/);
      expect(() => setAgentProject(CHECKED_IN_EXAMPLE_PROJECT, {})).toThrow(/Nothing to change/);
    });

    it("applies a palette and reports the new locale", () => {
      const project = { ...CHECKED_IN_EXAMPLE_PROJECT, locales: ["en-US", "es"] };
      const { state } = setAgentProject(project, { paletteId: "afterglow-pulse", locale: "es" });
      expect(state).toMatchObject({ paletteId: "afterglow-pulse", locale: "es" });
    });
  });

  it("suggests the nearest id for typos and shortened ids", () => {
    const ids = ["afterglow-rhythm", "product-cinema"];
    expect(closestId("afterglw", ids)).toBe("afterglow-rhythm");
    expect(closestId("prodcut-cinema", ids)).toBe("product-cinema");
    expect(closestId("zzz", ids)).toBeUndefined();
  });
});
