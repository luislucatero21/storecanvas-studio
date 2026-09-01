#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
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

const SUPPORTED_DEVICES = new Set([
  "iphone",
  "ipad",
  "android",
  "android-7",
  "android-10",
  "feature-graphic",
]);
const SUPPORTED_TONES = new Set(["light", "dark", "mixed"]);

function arg(name, fallback = undefined) {
  const index = process.argv.indexOf(name);
  if (index < 0 || index + 1 >= process.argv.length) return fallback;
  const value = process.argv[index + 1];
  return value && !value.startsWith("--") ? value : fallback;
}

function hasFlag(name) {
  return process.argv.includes(name);
}

function requiredArg(name, message = `${name} is required`) {
  const value = arg(name);
  if (!value) throw new Error(message);
  return value;
}

function integerArg(name, fallback, { min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = {}) {
  const raw = arg(name, String(fallback));
  const value = Number(raw);
  if (!Number.isInteger(value) || value < min || value > max) {
    throw new Error(`${name} must be an integer from ${min} to ${max}`);
  }
  return value;
}

function jsonOutput() {
  return hasFlag("--json") || arg("--format") === "json";
}

function output(payload, human) {
  if (jsonOutput()) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  console.log(human || JSON.stringify(payload, null, 2));
}

function help() {
  console.log(`StoreCanvas agent CLI

Usage:
  pnpm storecanvas catalog [--json]
  pnpm storecanvas inspect [--project <file>] [--json]
  pnpm storecanvas validate [--project <file>] [--json]
  pnpm storecanvas apply-template --template <id> [options]
  pnpm storecanvas generate-background --prompt <text> --slots <1-10> [options]
  pnpm storecanvas render [--all] [--device iphone] [--locale en-US] [--output exports/rendered]

Agent options:
  --project <file>             Read/write a specific project JSON file.
  --json                       Emit machine-readable output.
  --dry-run                    Show the planned mutation without writing or calling image AI.
  --no-backup                  Skip the automatic JSON backup before a write.
  --no-sync-app                Do not refresh the running local editor after a write.

Template options:
  --device <device>            Active deck; defaults to the project's device.
  --palette <id>               Apply an explicit palette after the template.
  --recommended-palette        Apply the template's recommended palette.
  --reset-customizations       Reset manual placement/constraints for that deck.
  --preserve-artwork           Keep connected artwork positions instead of reflowing them.

Background options:
  --template <id>              Apply this template before generating the artwork.
  --slots <1-10>               Number of adjacent screens covered by the artwork.
  --start-slot <1-10>          First screen in the range (one-based, default 1).
  --prompt <text>              Text-free visual direction for the image provider.
  --tone <light|dark|mixed>    Overall tonal direction; otherwise inferred from the deck.
  --tone-pattern <csv>         Example: light,dark,light,dark.
  --model <id>                 Image model (default: gpt-image-2).
  --api-key-env <name>         Environment variable for the provider key (default OPENAI_API_KEY).
  --artwork-id <id>            Stable id to replace/update on subsequent runs.

The local Next.js app must be running for catalog, template, validation and AI commands:
  pnpm dev -p 3100
`);
}

function resolveProjectFile() {
  const explicit = arg("--project") || arg("--project-file");
  if (explicit) return path.resolve(root, explicit);
  const configured = process.env.STORECANVAS_PROJECT_FILE?.trim();
  if (configured) return path.resolve(root, configured);
  const privatePath = path.resolve(root, "app-store-screenshots.json");
  return existsSync(privatePath) ? privatePath : path.resolve(root, "example-project.json");
}

async function loadProject(file = resolveProjectFile()) {
  let raw;
  try {
    raw = await fs.readFile(file, "utf8");
  } catch (error) {
    const message = error?.code === "ENOENT"
      ? `Project file not found: ${file}`
      : `Could not read project file: ${file}`;
    throw new Error(message);
  }
  try {
    return JSON.parse(raw);
  } catch {
    throw new Error(`Project file is not valid JSON: ${file}`);
  }
}

async function agentRequest(method, pathname, body) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), method === "POST" && body?.action === "generate-background" ? 120_000 : 20_000);
  try {
    const response = await fetch(new URL(pathname, baseUrl), {
      method,
      signal: controller.signal,
      headers: body ? { "content-type": "application/json" } : undefined,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload;
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`StoreCanvas returned non-JSON HTTP ${response.status}`);
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || `StoreCanvas agent request failed with HTTP ${response.status}`);
    }
    return payload;
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`StoreCanvas agent request timed out at ${baseUrl}.`);
    }
    if (error instanceof TypeError) {
      throw new Error(`Could not reach StoreCanvas at ${baseUrl}. Start the local dev server first.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function deckSummary(slides) {
  return {
    screens: Array.isArray(slides) ? slides.length : 0,
    connectedArtworks: Array.isArray(slides)
      ? slides.flatMap((slide, index) => (slide.connectedArtworks || []).map((artwork) => ({
          id: artwork.id,
          startSlot: index + 1,
          spanSlots: artwork.spanSlots,
          image: artwork.image,
        })))
      : [],
  };
}

function summarizeProject(project, projectFile) {
  return {
    projectFile,
    appName: project.appName,
    templateId: project.templateId,
    paletteId: project.paletteId,
    themeId: project.themeId,
    connectedCanvas: project.connectedCanvas,
    device: project.device,
    orientation: project.orientation,
    locale: project.locale,
    locales: project.locales,
    decks: Object.fromEntries(
      Object.entries(project.slidesByDevice || {}).map(([device, slides]) => [device, deckSummary(slides)]),
    ),
  };
}

async function persistProject(file, project) {
  let backup;
  if (!hasFlag("--no-backup")) {
    const backupDir = path.join(root, "exports", "backups");
    await fs.mkdir(backupDir, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    backup = path.join(backupDir, `${path.basename(file, path.extname(file))}-${stamp}.json`);
    await fs.copyFile(file, backup);
  }

  await fs.mkdir(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  try {
    await fs.writeFile(temporary, `${JSON.stringify(project, null, 2)}\n`, "utf8");
    await fs.rename(temporary, file);
  } catch (error) {
    await fs.rm(temporary, { force: true });
    throw error;
  }

  let appSynced = false;
  if (!hasFlag("--no-sync-app")) {
    try {
      await agentRequest("POST", "/api/project", project);
      appSynced = true;
    } catch {
      // The JSON file is still the canonical result when no browser is running.
    }
  }
  return { backup, appSynced };
}

function replaceArtworkImage(project, artworkId, previous, next) {
  return {
    ...project,
    slidesByDevice: Object.fromEntries(
      Object.entries(project.slidesByDevice || {}).map(([device, slides]) => [
        device,
        slides.map((slide) => ({
          ...slide,
          connectedArtworks: slide.connectedArtworks?.map((artwork) =>
            artwork.id === artworkId && artwork.image === previous
              ? { ...artwork, image: next }
              : artwork,
          ),
        })),
      ]),
    ),
  };
}

function extensionForMime(mime) {
  const normalized = mime.toLowerCase().split(";")[0];
  if (normalized === "image/jpeg" || normalized === "image/jpg") return "jpg";
  if (normalized === "image/webp") return "webp";
  return "png";
}

async function saveGeneratedBytes(bytes, mime = "image/png") {
  const hash = createHash("sha1").update(bytes).digest("hex").slice(0, 16);
  const filename = `${hash}.${extensionForMime(mime)}`;
  const destination = path.join(root, "public", "screenshots", "uploaded", filename);
  await fs.mkdir(path.dirname(destination), { recursive: true });
  try {
    await fs.access(destination);
  } catch {
    await fs.writeFile(destination, bytes);
  }
  return `/screenshots/uploaded/${filename}`;
}

async function materializeImagePath(value) {
  if (typeof value !== "string" || !value) throw new Error("Image provider returned no image path.");
  if (value.startsWith("data:")) {
    const match = /^data:([^;]+);base64,(.+)$/.exec(value);
    if (!match) throw new Error("Image provider returned an unsupported data URL.");
    return saveGeneratedBytes(Buffer.from(match[2], "base64"), match[1]);
  }

  if (value.startsWith("/")) {
    const localPath = path.resolve(root, "public", value.replace(/^\/+/, ""));
    try {
      await fs.access(localPath);
      return value;
    } catch {
      // A remote Vercel agent may return a path that must be downloaded locally.
    }
  }

  const remoteUrl = /^https?:\/\//i.test(value) ? value : new URL(value, baseUrl).toString();
  const response = await fetch(remoteUrl);
  if (!response.ok) throw new Error(`Could not download generated artwork (HTTP ${response.status}).`);
  const bytes = Buffer.from(await response.arrayBuffer());
  return saveGeneratedBytes(bytes, response.headers.get("content-type") || "image/png");
}

function parseTonePattern() {
  const raw = arg("--tone-pattern");
  if (!raw) return undefined;
  const pattern = raw.split(",").map((value) => value.trim().toLowerCase()).filter(Boolean);
  if (pattern.length === 0 || pattern.some((value) => !["light", "dark"].includes(value))) {
    throw new Error("--tone-pattern must be a comma-separated list of light and dark values.");
  }
  return pattern;
}

async function catalogCommand() {
  const payload = await agentRequest("GET", "/api/agent?view=catalog");
  if (jsonOutput()) {
    output(payload);
    return;
  }
  const templateLines = payload.templates
    .map((template) => `  ${template.id.padEnd(22)} ${template.name} — ${template.description}`)
    .join("\n");
  const paletteLines = payload.palettes
    .map((palette) => `  ${palette.id.padEnd(22)} ${palette.name} (${palette.themeId})`)
    .join("\n");
  output(payload, `Templates:\n${templateLines}\n\nPalettes:\n${paletteLines}`);
}

async function inspectCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const summary = summarizeProject(project, projectFile);
  output(summary, `${summary.appName} · ${summary.device} · ${summary.orientation}\n${Object.entries(summary.decks).map(([device, deck]) => `  ${device}: ${deck.screens} screens, ${deck.connectedArtworks.length} connected artwork`).join("\n")}`);
}

async function validateCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const payload = await agentRequest("POST", "/api/agent", {
    action: "validate",
    project,
    strict: !hasFlag("--warnings-only"),
  });
  const result = { projectFile, ...payload };
  output(result, `${payload.validation.valid ? "Valid" : "Needs attention"}: ${payload.validation.errors.length} errors, ${payload.validation.warnings.length} warnings`);
  if (!payload.validation.valid) process.exitCode = 2;
}

async function applyTemplateCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const templateId = requiredArg("--template", "--template <id> is required");
  const device = arg("--device", project.device);
  if (!SUPPORTED_DEVICES.has(device)) throw new Error(`Unsupported device: ${device}`);
  const response = await agentRequest("POST", "/api/agent", {
    action: "apply-template",
    project,
    templateId,
    device,
    paletteId: arg("--palette"),
    applyRecommendedPalette: hasFlag("--recommended-palette"),
    resetCustomizations: hasFlag("--reset-customizations"),
    reflowConnectedArtwork: !hasFlag("--preserve-artwork"),
  });
  const result = {
    command: "apply-template",
    projectFile,
    templateId,
    dryRun: hasFlag("--dry-run"),
    summary: response.summary,
  };
  if (!hasFlag("--dry-run")) Object.assign(result, await persistProject(projectFile, response.state));
  output(result, `${hasFlag("--dry-run") ? "Would apply" : "Applied"} ${templateId} to ${device}${result.backup ? ` · backup ${result.backup}` : ""}`);
}

async function generateBackgroundCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const prompt = requiredArg("--prompt", "--prompt <text> is required");
  const device = arg("--device", project.device);
  if (!SUPPORTED_DEVICES.has(device)) throw new Error(`Unsupported device: ${device}`);
  const spanSlots = integerArg("--slots", 2, { min: 1, max: 10 });
  const startSlot = integerArg("--start-slot", 1, { min: 1, max: 10 });
  const deckLength = Array.isArray(project.slidesByDevice?.[device]) ? project.slidesByDevice[device].length : 0;
  if (startSlot + spanSlots - 1 > deckLength) {
    throw new Error(`Artwork range ${startSlot}–${startSlot + spanSlots - 1} exceeds the ${device} deck (${deckLength} screens).`);
  }
  const tone = arg("--tone");
  if (tone && !SUPPORTED_TONES.has(tone)) throw new Error("--tone must be light, dark or mixed.");
  const tonePattern = parseTonePattern();
  if (tonePattern && tonePattern.length > spanSlots) throw new Error("--tone-pattern cannot contain more values than --slots.");
  const templateId = arg("--template");
  const apiKeyEnv = arg("--api-key-env", "OPENAI_API_KEY");
  const model = arg("--model", "gpt-image-2");
  const plan = {
    command: "generate-background",
    projectFile,
    device,
    startSlot,
    spanSlots,
    templateId,
    model,
    tone: tone || "inferred",
    tonePattern: tonePattern || "inferred from deck",
    artworkId: arg("--artwork-id") || `ai-background-${startSlot}-${spanSlots}`,
  };
  if (hasFlag("--dry-run")) {
    output({ ...plan, dryRun: true }, `Would generate ${spanSlots} connected slots starting at ${startSlot}${templateId ? ` with ${templateId}` : ""}`);
    return;
  }

  const apiKey = process.env[apiKeyEnv];
  if (!apiKey) throw new Error(`Set ${apiKeyEnv} before generating artwork. The key is sent request-scoped and never written to JSON.`);
  const response = await agentRequest("POST", "/api/agent", {
    action: "generate-background",
    project,
    device,
    startSlot,
    spanSlots,
    templateId,
    applyTemplate: !!templateId && !hasFlag("--no-template"),
    paletteId: arg("--palette"),
    applyRecommendedPalette: hasFlag("--recommended-palette"),
    resetCustomizations: hasFlag("--reset-customizations"),
    reflowConnectedArtwork: !hasFlag("--preserve-artwork"),
    prompt,
    tone,
    tonePattern,
    model,
    apiKey,
    artworkId: arg("--artwork-id"),
  });
  const localImage = await materializeImagePath(response.path);
  const state = response.path === localImage
    ? response.state
    : replaceArtworkImage(response.state, response.artworkId, response.path, localImage);
  const result = {
    ...plan,
    image: localImage,
    tone: response.tone,
    tonePattern: response.tonePattern,
    prompt: response.prompt,
    dryRun: false,
    summary: response.summary,
    ...(await persistProject(projectFile, state)),
  };
  output(result, `Generated ${localImage} across slots ${startSlot}–${startSlot + spanSlots - 1}${result.backup ? ` · backup ${result.backup}` : ""}`);
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

async function renderCommand() {
  const { chromium } = await import("@playwright/test");
  const project = await loadProject(resolveProjectFile());
  if (!hasFlag("--no-sync-app")) {
    try {
      await agentRequest("POST", "/api/project", project);
    } catch {
      // Rendering can still use the server's configured project when no app is running.
    }
  }
  const outputDir = path.resolve(root, arg("--output", "exports/rendered"));
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
            const destination = path.join(outputDir, device, `${size.w}x${size.h}`, locale, filename);
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
  output({ command: "render", count, output: outputDir }, `Rendered ${count} PNG${count === 1 ? "" : "s"} to ${outputDir}`);
}

async function main() {
  // pnpm/npm may preserve the separator when the command is invoked through a
  // package script (`pnpm run storecanvas -- inspect`). Accept both forms so
  // agents can use the documented bin or the package script interchangeably.
  const commandIndex = process.argv[2] === "--" ? 3 : 2;
  const command = process.argv[commandIndex] || "help";
  if (command === "help" || command === "--help" || hasFlag("--help")) {
    help();
    return;
  }
  if (command === "catalog" || command === "templates") return catalogCommand();
  if (command === "inspect") return inspectCommand();
  if (command === "validate") return validateCommand();
  if (command === "apply-template" || command === "template") return applyTemplateCommand();
  if (command === "generate-background" || command === "background") return generateBackgroundCommand();
  if (command === "render") return renderCommand();
  throw new Error(`Unknown command: ${command}. Run pnpm storecanvas --help.`);
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  if (jsonOutput()) console.log(JSON.stringify({ ok: false, error: message }, null, 2));
  else console.error(`Error: ${message}`);
  process.exitCode = 1;
});
