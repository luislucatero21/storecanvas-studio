import { describe, expect, it, vi } from "vitest";
import {
  deriveBrandColorSignalsFromPixels,
  fetchAppStoreCampaign,
} from "@/lib/app-store-server";

function pixels(entries: Array<{ color: string; count: number }>) {
  const channels: number[] = [];
  for (const { color, count } of entries) {
    const value = Number.parseInt(color.slice(1), 16);
    const rgb = [value >> 16, (value >> 8) & 255, value & 255];
    for (let index = 0; index < count; index += 1) channels.push(...rgb);
  }
  return Uint8Array.from(channels);
}

describe("App Store import server", () => {
  it("derives useful light, ink, cool and warm signals from observed pixels", () => {
    const signals = deriveBrandColorSignalsFromPixels([
      pixels([
        { color: "#EAF5FF", count: 100 },
        { color: "#11143B", count: 45 },
        { color: "#18BDEB", count: 35 },
        { color: "#FF9E35", count: 30 },
      ]),
    ]);

    expect(signals).toEqual({
      surface: "#EAF5FF",
      ink: "#11143B",
      primary: "#18BDEB",
      accent: "#FF9E35",
    });
  });

  it("looks up only the parsed Apple app id and returns a generated campaign", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url === "https://itunes.apple.com/lookup?id=1234567890&country=mx&entity=software") {
        return new Response(JSON.stringify({
          resultCount: 1,
          results: [{
            trackName: "Example app",
            description: "PLANEA CON IA. Tú apruebas cada cambio. PRIVACIDAD PRIMERO. Metas y tendencias.",
            primaryGenreName: "Productivity",
            version: "1.6.1",
            artworkUrl512: "https://is1-ssl.mzstatic.com/icon.jpg",
            screenshotUrls: ["https://is1-ssl.mzstatic.com/store-01.jpg"],
          }],
        }), { status: 200, headers: { "content-type": "application/json" } });
      }
      expect(url).toMatch(/^https:\/\/is1-ssl\.mzstatic\.com\//);
      return new Response(Uint8Array.from([0, 1, 2, 3]), {
        status: 200,
        headers: { "content-type": "image/jpeg" },
      });
    });
    const analyzeImages = vi.fn(async () => ({
      surface: "#EAF5FF",
      ink: "#11143B",
      primary: "#18BDEB",
      accent: "#FF9E35",
    }));

    const result = await fetchAppStoreCampaign(
      "https://apps.apple.com/mx/app/demo/id1234567890",
      {
        fetchImpl: fetchImpl as typeof fetch,
        cacheAssets: false,
        analyzeImages,
      },
    );

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(analyzeImages).toHaveBeenCalledWith([Buffer.from([0, 1, 2, 3]), Buffer.from([0, 1, 2, 3])]);
    expect(result.listing).toMatchObject({
      appId: "1234567890",
      country: "mx",
      locale: "es-MX",
      name: "Example app",
      screenshotUrls: ["https://is1-ssl.mzstatic.com/store-01.jpg"],
      localArtworkPath: "/api/import/app-store/image?url=https%3A%2F%2Fis1-ssl.mzstatic.com%2Ficon.jpg",
      localScreenshotPaths: ["/api/import/app-store/image?url=https%3A%2F%2Fis1-ssl.mzstatic.com%2Fstore-01.jpg"],
    });
    expect(result.proposal).toMatchObject({
      baseTemplateId: "afterglow-rhythm",
      palette: { name: "Example app sky rhythm" },
    });
  });
});
