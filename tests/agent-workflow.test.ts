import { describe, expect, it } from "vitest";
import { POST, GET } from "@/app/api/agent/route";
import {
  applyAgentTemplate,
  assertConnectedArtworkRange,
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
});
