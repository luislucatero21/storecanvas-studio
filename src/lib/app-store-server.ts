import { promises as fs } from "node:fs";
import path from "node:path";
import sharp from "sharp";
import {
  buildCampaignImportProposal,
  parseAppStoreUrl,
  type AppStoreListing,
  type BrandColorSignals,
} from "./app-store-import";

type FetchLike = typeof fetch;

type LookupResult = {
  trackName?: string;
  description?: string;
  primaryGenreName?: string;
  version?: string;
  artworkUrl512?: string;
  screenshotUrls?: string[];
};

type PixelBucket = {
  count: number;
  r: number;
  g: number;
  b: number;
};

export class AppStoreImportError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "AppStoreImportError";
  }
}

function toHex({ r, g, b }: { r: number; g: number; b: number }) {
  return `#${[r, g, b].map((value) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function hsl({ r, g, b }: { r: number; g: number; b: number }) {
  const [red, green, blue] = [r / 255, g / 255, b / 255];
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  const lightness = (max + min) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  let hue = 0;
  if (delta !== 0) {
    if (max === red) hue = 60 * (((green - blue) / delta) % 6);
    else if (max === green) hue = 60 * ((blue - red) / delta + 2);
    else hue = 60 * ((red - green) / delta + 4);
  }
  return { hue: (hue + 360) % 360, saturation, lightness, chroma: delta };
}

function fromHsl(hue: number, saturation: number, lightness: number) {
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const section = ((hue % 360) + 360) % 360 / 60;
  const x = chroma * (1 - Math.abs((section % 2) - 1));
  const [r1, g1, b1] = section < 1 ? [chroma, x, 0]
    : section < 2 ? [x, chroma, 0]
      : section < 3 ? [0, chroma, x]
        : section < 4 ? [0, x, chroma]
          : section < 5 ? [x, 0, chroma]
            : [chroma, 0, x];
  const offset = lightness - chroma / 2;
  return { r: (r1 + offset) * 255, g: (g1 + offset) * 255, b: (b1 + offset) * 255 };
}

export function deriveBrandColorSignalsFromPixels(pixelSets: Uint8Array[]): BrandColorSignals {
  const buckets = new Map<string, PixelBucket>();
  for (const pixels of pixelSets) {
    for (let offset = 0; offset + 2 < pixels.length; offset += 3) {
      const r = pixels[offset];
      const g = pixels[offset + 1];
      const b = pixels[offset + 2];
      const key = `${r >> 4}-${g >> 4}-${b >> 4}`;
      const bucket = buckets.get(key) || { count: 0, r: 0, g: 0, b: 0 };
      bucket.count += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
      buckets.set(key, bucket);
    }
  }

  const colors = Array.from(buckets.values()).map((bucket) => {
    const color = { r: bucket.r / bucket.count, g: bucket.g / bucket.count, b: bucket.b / bucket.count };
    return { ...color, count: bucket.count, ...hsl(color) };
  });
  const byCount = (a: (typeof colors)[number], b: (typeof colors)[number]) => b.count - a.count;
  const lightColors = colors.filter((color) => color.lightness >= 0.78);
  const surface = lightColors
    .filter((color) => color.hue >= 175 && color.hue <= 255 && color.chroma >= 0.05)
    .sort((a, b) => b.count * b.chroma - a.count * a.chroma)[0] || lightColors.sort(byCount)[0];
  const darkColors = colors.filter((color) => color.lightness <= 0.29);
  const ink = darkColors
    .filter((color) => color.hue >= 205 && color.hue <= 285 && color.chroma >= 0.05)
    .sort((a, b) => a.lightness - b.lightness || b.count - a.count)[0] || darkColors.sort(byCount)[0];
  const primary = colors
    .filter((color) => color.hue >= 170 && color.hue <= 265 && color.saturation >= 0.5 && color.chroma >= 0.22 && color.lightness >= 0.24 && color.lightness <= 0.7)
    .sort((a, b) => Math.sqrt(b.count) * b.chroma ** 2 * (1 - Math.abs(b.lightness - 0.5)) - Math.sqrt(a.count) * a.chroma ** 2 * (1 - Math.abs(a.lightness - 0.5)))[0];
  const accent = colors
    .filter((color) => (color.hue >= 8 && color.hue <= 72) && color.saturation >= 0.5 && color.chroma >= 0.22 && color.lightness >= 0.25 && color.lightness <= 0.72)
    .sort((a, b) => Math.sqrt(b.count) * b.chroma ** 2 * (1 - Math.abs(b.lightness - 0.5)) - Math.sqrt(a.count) * a.chroma ** 2 * (1 - Math.abs(a.lightness - 0.5)))[0];

  const surfaceHex = surface ? toHex(surface) : "#F3F6FA";
  const inkHex = ink
    ? toHex(ink.lightness > 0.2 ? fromHsl(ink.hue, Math.max(ink.saturation, 0.46), 0.16) : ink)
    : "#172033";
  const primaryHex = primary
    ? toHex(primary.saturation < 0.75
      ? fromHsl(surface && surface.hue >= 170 && surface.hue <= 265 ? primary.hue * 0.45 + surface.hue * 0.55 : primary.hue, 0.78, Math.min(primary.lightness, 0.56))
      : primary)
    : "#5267D8";
  const accentHex = accent
    ? toHex(accent.lightness > 0.64 ? fromHsl(accent.hue, Math.max(accent.saturation, 0.82), 0.58) : accent)
    : "#F08A5D";
  return {
    surface: surfaceHex,
    ink: inkHex,
    primary: primaryHex,
    accent: accentHex,
  };
}

export async function extractBrandColorSignals(buffers: Buffer[]) {
  const pixelSets = await Promise.all(
    buffers.slice(0, 5).map(async (buffer, index) => {
      const image = sharp(buffer);
      const metadata = await image.metadata();
      const crop = index > 0 && metadata.width && metadata.height
        ? image.extract({ left: 0, top: 0, width: metadata.width, height: Math.max(1, Math.round(metadata.height * 0.42)) })
        : image;
      const pixels = await crop
        .resize({ width: 64, height: 64, fit: "inside", withoutEnlargement: true })
        .removeAlpha()
        .raw()
        .toBuffer();
      return new Uint8Array(pixels);
    }),
  );
  return deriveBrandColorSignalsFromPixels(pixelSets);
}

function localeForCountry(country: string) {
  if (country === "mx") return "es-MX";
  if (country === "es") return "es-ES";
  if (country === "br") return "pt-BR";
  return "en-US";
}

function assertAppleImageUrl(rawUrl: string) {
  const url = new URL(rawUrl);
  if (url.protocol !== "https:" || !url.hostname.endsWith(".mzstatic.com")) {
    throw new AppStoreImportError("Apple returned an unsupported image host.", 502);
  }
  return url;
}

async function downloadAppleImage(rawUrl: string, fetchImpl: FetchLike) {
  assertAppleImageUrl(rawUrl);
  const response = await fetchImpl(rawUrl, { signal: AbortSignal.timeout(20_000) });
  if (!response.ok) throw new AppStoreImportError(`Apple image download failed with HTTP ${response.status}.`, 502);
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.byteLength > 15 * 1024 * 1024) throw new AppStoreImportError("An App Store image exceeded the 15 MB import limit.", 413);
  const contentType = response.headers.get("content-type") || "image/jpeg";
  const extension = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  return { buffer, extension };
}

async function cacheListingAssets(
  listing: AppStoreListing,
  fetchImpl: FetchLike,
  publicDir: string,
) {
  const directoryName = `apple-${listing.appId}`;
  const absoluteDirectory = path.join(publicDir, "screenshots", "imported", directoryName);
  await fs.mkdir(absoluteDirectory, { recursive: true });

  const artworkPromise = listing.artworkUrl
    ? downloadAppleImage(listing.artworkUrl, fetchImpl).then(async ({ buffer, extension }) => {
        const filename = `icon.${extension}`;
        await fs.writeFile(path.join(absoluteDirectory, filename), buffer);
        return { buffer, path: `/screenshots/imported/${directoryName}/${filename}` };
      }).catch(() => null)
    : Promise.resolve(null);
  const screenshotPromises = listing.screenshotUrls.map((url, index) =>
    downloadAppleImage(url, fetchImpl).then(async ({ buffer, extension }) => {
      const filename = `store-${String(index + 1).padStart(2, "0")}.${extension}`;
      await fs.writeFile(path.join(absoluteDirectory, filename), buffer);
      return { buffer, path: `/screenshots/imported/${directoryName}/${filename}` };
    }).catch(() => null),
  );
  const [artwork, screenshots] = await Promise.all([artworkPromise, Promise.all(screenshotPromises)]);
  const buffers: Buffer[] = [];
  if (artwork?.buffer) buffers.push(artwork.buffer);
  for (const item of screenshots.slice(0, 4)) {
    if (item?.buffer) buffers.push(item.buffer);
  }
  return {
    artwork,
    screenshots,
    buffers,
  };
}

async function downloadListingBuffers(listing: AppStoreListing, fetchImpl: FetchLike) {
  const urls = [listing.artworkUrl, ...listing.screenshotUrls].filter(
    (url): url is string => typeof url === "string" && url.length > 0,
  ).slice(0, 5);
  const results = await Promise.all(
    urls.map((url) => downloadAppleImage(url, fetchImpl).then(({ buffer }) => buffer).catch(() => null)),
  );
  return results.filter((buffer) => !!buffer) as Buffer[];
}

function proxyAssetPath(rawUrl: string) {
  return `/api/import/app-store/image?url=${encodeURIComponent(rawUrl)}`;
}

export async function fetchAppStoreCampaign(
  rawUrl: string,
  options: {
    fetchImpl?: FetchLike;
    publicDir?: string;
    cacheAssets?: boolean;
    analyzeImages?: (buffers: Buffer[]) => Promise<BrandColorSignals>;
  } = {},
) {
  const parsed = parseAppStoreUrl(rawUrl);
  const fetchImpl = options.fetchImpl || fetch;
  const lookupUrl = `https://itunes.apple.com/lookup?id=${parsed.appId}&country=${parsed.country}&entity=software`;
  let response: Response;
  try {
    response = await fetchImpl(lookupUrl, { signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new AppStoreImportError("StoreCanvas could not reach Apple's public listing service.", 502);
  }
  if (!response.ok) throw new AppStoreImportError(`Apple listing lookup failed with HTTP ${response.status}.`, 502);
  const body = await response.json() as { resultCount?: number; results?: LookupResult[] };
  const result = body.results?.[0];
  if (!result || body.resultCount === 0 || !result.trackName || !result.description) {
    throw new AppStoreImportError("Apple did not return a public app listing for this URL.", 404);
  }

  let listing: AppStoreListing = {
    sourceUrl: parsed.canonicalUrl,
    appId: parsed.appId,
    country: parsed.country,
    locale: localeForCountry(parsed.country),
    name: result.trackName,
    description: result.description,
    genre: result.primaryGenreName,
    version: result.version,
    artworkUrl: result.artworkUrl512,
    screenshotUrls: (result.screenshotUrls || []).slice(0, 10),
    localScreenshotPaths: [],
  };

  const analyzeImages = options.analyzeImages || extractBrandColorSignals;
  let colorSignals: BrandColorSignals;
  if (options.cacheAssets === false) {
    // Keep the filesystem read-only but still inspect the current listing
    // screenshots in memory so Vercel can derive a useful palette. The browser
    // later loads the same images through the same-origin proxy paths below.
    colorSignals = await analyzeImages(await downloadListingBuffers(listing, fetchImpl));
    // The browser can still use published captures without writing them into
    // a server filesystem. Same-origin proxy paths also make export reliable
    // when Apple's image host does not expose permissive CORS headers.
    listing = {
      ...listing,
      ...(listing.artworkUrl ? { localArtworkPath: proxyAssetPath(listing.artworkUrl) } : {}),
      localScreenshotPaths: listing.screenshotUrls.map(proxyAssetPath),
    };
  } else {
    const cached = await cacheListingAssets(listing, fetchImpl, options.publicDir || path.join(process.cwd(), "public"));
    listing = {
      ...listing,
      ...(cached.artwork ? { localArtworkPath: cached.artwork.path } : {}),
      localScreenshotPaths: cached.screenshots.map((item) => item?.path || ""),
    };
    colorSignals = await analyzeImages(cached.buffers);
  }

  const proposal = buildCampaignImportProposal(listing, {
    colorSignals,
    slideCount: Math.max(6, listing.screenshotUrls.length),
  });
  return { listing, proposal };
}
