import { describe, expect, it, vi } from "vitest";
import {
  deriveBrandColorSignalsFromPixels,
  fetchAppleImage,
  fetchAppStoreCampaign,
} from "@/lib/app-store-server";
import { GET as proxyImage } from "@/app/api/import/app-store/image/route";

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

  it("refuses an Apple image redirect that leaves Apple's https image CDN", async () => {
    const fetchImpl = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      expect(init?.redirect).toBe("manual");
      const url = String(input);
      if (url === "https://is1-ssl.mzstatic.com/a.jpg") {
        return new Response(null, { status: 302, headers: { location: "https://is2-ssl.mzstatic.com/b.jpg" } });
      }
      if (url === "https://is2-ssl.mzstatic.com/b.jpg") {
        return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } });
      }
      throw new Error(`unexpected fetch ${url}`);
    });

    await expect(fetchAppleImage("https://is1-ssl.mzstatic.com/a.jpg", fetchImpl as typeof fetch))
      .rejects.toThrow("unsupported image host");
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("follows Apple-to-Apple redirects and accepts only bounded raster images", async () => {
    const image = (contentType: string, body: BodyInit | null = Uint8Array.from([1, 2, 3]), extra: Record<string, string> = {}) =>
      vi.fn(async () => new Response(body, { status: 200, headers: { "content-type": contentType, ...extra } }));

    await expect(fetchAppleImage("https://is1-ssl.mzstatic.com/a.png", image("image/png") as typeof fetch))
      .resolves.toMatchObject({ extension: "png", contentType: "image/png" });
    await expect(fetchAppleImage("https://is1-ssl.mzstatic.com/a.svg", image("image/svg+xml") as typeof fetch))
      .rejects.toThrow("non-image");
    await expect(fetchAppleImage("https://is1-ssl.mzstatic.com/a", image("text/html") as typeof fetch))
      .rejects.toThrow("non-image");
    await expect(fetchAppleImage(
      "https://is1-ssl.mzstatic.com/big.jpg",
      image("image/jpeg", null, { "content-length": String(16 * 1024 * 1024) }) as typeof fetch,
    )).rejects.toThrow("15 MB");
    const oversizedStream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(1024 * 1024));
      },
    });
    await expect(fetchAppleImage("https://is1-ssl.mzstatic.com/stream.jpg", image("image/jpeg", oversizedStream) as typeof fetch))
      .rejects.toThrow("15 MB");
    await expect(fetchAppleImage("https://user@is1-ssl.mzstatic.com/a.png", image("image/png") as typeof fetch))
      .rejects.toThrow("unsupported image host");
    await expect(fetchAppleImage("https://mzstatic.com.example.net/a.png", image("image/png") as typeof fetch))
      .rejects.toThrow("unsupported image host");
  });

  it("serves proxied Apple images as inert, non-sniffable bytes", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(Uint8Array.from([1, 2, 3]), {
      status: 200,
      headers: { "content-type": "image/png" },
    })));
    try {
      const response = await proxyImage(new Request(
        `http://localhost/api/import/app-store/image?url=${encodeURIComponent("https://is1-ssl.mzstatic.com/a.png")}`,
      ));
      expect(response.status).toBe(200);
      expect(response.headers.get("x-content-type-options")).toBe("nosniff");
      expect(response.headers.get("content-security-policy")).toContain("sandbox");

      const rejected = await proxyImage(new Request(
        `http://localhost/api/import/app-store/image?url=${encodeURIComponent("http://127.0.0.1:3000/api/project")}`,
      ));
      expect(rejected.status).toBe(400);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});
