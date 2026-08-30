import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { chromium } from "@playwright/test";

const root = process.cwd();
const projectFile = path.join(root, "app-store-screenshots.json");
const baseUrl = process.env.STORECANVAS_URL || "http://127.0.0.1:3100";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

const defaultSizes = {
  iphone: [{ w: 1320, h: 2868 }],
  ipad: [{ w: 2064, h: 2752 }],
  android: [{ w: 1080, h: 1920 }],
  "android-7": [{ w: 1200, h: 1920 }],
  "android-10": [{ w: 1600, h: 2560 }],
  "feature-graphic": [{ w: 1024, h: 500 }],
};

const landscapeSizes = {
  "android-7": [{ w: 1920, h: 1200 }],
  "android-10": [{ w: 2560, h: 1600 }],
};

function arg(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] || fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function help() {
  console.log(`StoreCanvas renderer

Usage:
  pnpm storecanvas render [--all] [--device iphone] [--locale en-US] [--output exports/rendered]

The dev server must be running at ${baseUrl} (override with STORECANVAS_URL).
`);
}

async function loadProject() {
  const raw = await fs.readFile(projectFile, "utf8");
  return JSON.parse(raw);
}

function localesFor(project) {
  const requested = arg("--locale");
  if (requested) return [requested];
  return hasFlag("--all") ? project.locales : [project.locale];
}

function devicesFor(project) {
  const requested = arg("--device");
  if (requested) return [requested];
  if (hasFlag("--all")) {
    return Object.entries(project.slidesByDevice)
      .filter(([, slides]) => Array.isArray(slides) && slides.length > 0)
      .map(([device]) => device);
  }
  return [project.device];
}

async function render() {
  const project = await loadProject();
  const output = path.resolve(root, arg("--output", "exports/rendered"));
  const browser = await chromium.launch(executablePath ? { executablePath } : {});
  const context = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await context.newPage();
  let count = 0;

  try {
    for (const device of devicesFor(project)) {
      const orientation = project.orientation === "landscape" ? "landscape" : "portrait";
      const sizes = orientation === "landscape" ? landscapeSizes[device] || defaultSizes[device] : defaultSizes[device];
      if (!sizes) throw new Error(`Unknown device: ${device}`);
      for (const locale of localesFor(project)) {
        for (const size of sizes) {
          const url = new URL("/render", baseUrl);
          url.searchParams.set("device", device);
          url.searchParams.set("orientation", orientation);
          url.searchParams.set("locale", locale);
          url.searchParams.set("size", `${size.w}x${size.h}`);
          await page.goto(url.toString(), { waitUntil: "networkidle" });
          await page.locator('[data-render-valid="true"]').waitFor();
          await page.waitForFunction(() => Array.from(document.images).every((image) => image.complete));
          const slides = page.locator("[data-render-slide]");
          const total = await slides.count();
          for (let index = 0; index < total; index += 1) {
            const slide = slides.nth(index);
            const slideId = await slide.getAttribute("data-slide-id");
            const layout = await slide.getAttribute("data-layout");
            const filename = `${String(index + 1).padStart(2, "0")}-${layout || slideId || "slide"}.png`;
            const destination = path.join(output, device, `${size.w}x${size.h}`, locale, filename);
            await fs.mkdir(path.dirname(destination), { recursive: true });
            await slide.screenshot({ path: destination });
            count += 1;
          }
        }
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`Rendered ${count} PNG${count === 1 ? "" : "s"} to ${output}`);
}

if (process.argv[2] === "render") {
  await render();
} else {
  help();
}
