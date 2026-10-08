#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { promises as fs } from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const baseUrl = process.env.STORECANVAS_URL || "http://127.0.0.1:3100";
const executablePath = process.env.PLAYWRIGHT_EXECUTABLE_PATH;

// Mirrors EXPORT_SIZES in src/lib/constants.ts so selected sizes render from the CLI too.
const defaultSizes = {
  iphone: [
    { id: "iphone-6.9", w: 1320, h: 2868 },
    { id: "iphone-6.5", w: 1284, h: 2778 },
    { id: "iphone-6.3", w: 1206, h: 2622 },
    { id: "iphone-6.1", w: 1125, h: 2436 },
  ],
  ipad: [
    { id: "ipad-13", w: 2064, h: 2752 },
    { id: "ipad-12.9", w: 2048, h: 2732 },
  ],
  android: [{ id: "android-phone", w: 1080, h: 1920 }],
  "android-7": [{ id: "android-7-portrait", w: 1200, h: 1920 }],
  "android-10": [{ id: "android-10-portrait", w: 1600, h: 2560 }],
  "feature-graphic": [{ id: "feature-graphic", w: 1024, h: 500 }],
};

const rotated = (sizes) => sizes.map((size) => ({ id: `${size.id}-landscape`, w: size.h, h: size.w }));

const landscapeSizes = {
  iphone: rotated(defaultSizes.iphone),
  ipad: rotated(defaultSizes.ipad),
  "android-7": [{ id: "android-7-landscape", w: 1920, h: 1200 }],
  "android-10": [{ id: "android-10-landscape", w: 2560, h: 1600 }],
};

const sizeClassId = (id) => id.replace(/-(portrait|landscape)$/, "");

const SUPPORTED_DEVICES = new Set([
  "iphone",
  "ipad",
  "android",
  "android-7",
  "android-10",
  "feature-graphic",
]);
const SUPPORTED_TONES = new Set(["light", "dark", "mixed"]);

class CliError extends Error {
  constructor(message, hint) {
    super(message);
    this.hint = hint;
  }
}

// Like arg(), but accepts empty strings and values starting with "--" (copy text).
function textArg(name) {
  const index = process.argv.indexOf(name);
  if (index < 0) return undefined;
  if (index + 1 >= process.argv.length) throw new CliError(`${name} requires a value.`);
  return process.argv[index + 1];
}

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

const LAYOUTS = ["hero", "device-bottom", "device-top", "two-devices", "no-device", "split-landscape", "feature-graphic"];

// Single source for human help, per-command help and `help --json`.
const COMMON_FLAGS = [
  { name: "--project", value: "file", description: "Read/write a specific project JSON file (default: STORECANVAS_PROJECT_FILE, app-store-screenshots.json, then example-project.json)." },
  { name: "--json", description: "Emit machine-readable output (errors become {ok:false,error,hint})." },
];
const WRITE_FLAGS = [
  { name: "--dry-run", description: "Show the planned change without writing." },
  { name: "--no-backup", description: "Skip the automatic JSON backup in exports/backups/." },
  { name: "--no-sync-app", description: "Do not refresh the running local editor after a write." },
];
const DEVICE_FLAG = { name: "--device", value: "device", description: "Device deck: iphone, ipad, android, android-7, android-10, feature-graphic (default: project device)." };
const LOCALE_FLAG = { name: "--locale", value: "locale", description: "Locale code from the project's locales (default: project locale)." };

const COMMANDS = [
  {
    name: "catalog", aliases: ["templates"], summary: "List valid devices, templates, palettes and capabilities.",
    usage: "pnpm storecanvas catalog [--json]", flags: [], needsApp: true, writes: false,
    examples: ["pnpm storecanvas catalog --json"],
  },
  {
    name: "inspect", aliases: [], summary: "Summarize the project: app, device, locales, decks, connected artwork.",
    usage: "pnpm storecanvas inspect [--project <file>] [--json]", flags: [], needsApp: false, writes: false,
    examples: ["pnpm storecanvas inspect --json"],
  },
  {
    name: "screens", aliases: ["list-screens"], summary: "List each screen's layout, copy, screenshot path, artwork and hidden layers.",
    usage: "pnpm storecanvas screens [--device <d>] [--locale <l>] [--json]",
    flags: [DEVICE_FLAG, LOCALE_FLAG], needsApp: false, writes: false,
    examples: ["pnpm storecanvas screens --json", "pnpm storecanvas screens --device ipad --locale es"],
  },
  {
    name: "edit-screen", aliases: ["set-copy"], summary: "Change one screen's headline, label, layout or screenshots.",
    usage: "pnpm storecanvas edit-screen --screen <n> [--headline <text>] [--label <text>] [--layout <id>] [--image <file>] [--secondary-image <file>] [options]",
    flags: [
      { name: "--screen", value: "1-10", description: "One-based screen number.", required: true },
      DEVICE_FLAG,
      LOCALE_FLAG,
      { name: "--headline", value: "text", description: "Headline for the locale (empty string clears it; follows copy linking between decks)." },
      { name: "--label", value: "text", description: "Small label above the headline for the locale." },
      { name: "--layout", value: "id", description: `One of ${LAYOUTS.join(", ")}. Resets manual transforms on that screen.` },
      { name: "--image", value: "file", description: "Replace the screenshot with a png/jpg/webp file." },
      { name: "--secondary-image", value: "file", description: "Replace the second device screenshot (two-devices layout only)." },
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: [
      'pnpm storecanvas edit-screen --screen 2 --headline "Track every payment" --label "Insights" --json',
      "pnpm storecanvas edit-screen --screen 3 --layout device-top --image ~/shots/home.png",
    ],
  },
  {
    name: "set-project", aliases: [], summary: "Switch device, orientation, locale, app name, palette or connected canvas.",
    usage: "pnpm storecanvas set-project [--device <d>] [--orientation portrait|landscape] [--locale <l>] [--app-name <name>] [--palette <id>] [--connected on|off] [options]",
    flags: [
      { name: "--device", value: "device", description: "Make this the active device." },
      { name: "--orientation", value: "portrait|landscape", description: "Landscape only for iphone, ipad, android-7, android-10." },
      { name: "--locale", value: "locale", description: "Make this the active locale (must already be in the project's locales)." },
      { name: "--app-name", value: "name", description: "Rename the app." },
      { name: "--palette", value: "id", description: "Apply a palette id from catalog." },
      { name: "--connected", value: "on|off", description: "Turn the connected canvas on or off." },
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: ["pnpm storecanvas set-project --device ipad --orientation landscape", "pnpm storecanvas set-project --palette afterglow-pulse --connected on --json"],
  },
  {
    name: "validate", aliases: [], summary: "Run schema and export-readiness checks (exit 2 when invalid).",
    usage: "pnpm storecanvas validate [--warnings-only] [--json]",
    flags: [{ name: "--warnings-only", description: "Do not treat warnings as blocking." }], needsApp: true, writes: false,
    examples: ["pnpm storecanvas validate --json"],
  },
  {
    name: "apply-template", aliases: ["template"], summary: "Recompose a device deck with a campaign template.",
    usage: "pnpm storecanvas apply-template --template <id> [options]",
    flags: [
      { name: "--template", value: "id", description: "Template id from catalog.", required: true },
      DEVICE_FLAG,
      { name: "--palette", value: "id", description: "Apply an explicit palette after the template." },
      { name: "--recommended-palette", description: "Apply the template's recommended palette." },
      { name: "--reset-customizations", description: "Reset manual placement/constraints for that deck." },
      { name: "--preserve-artwork", description: "Keep connected artwork positions instead of reflowing them." },
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: ["pnpm storecanvas apply-template --template afterglow-rhythm --recommended-palette --json"],
  },
  {
    name: "remove-element", aliases: ["delete-element"], summary: "Remove a text/artwork/extra-device layer, or hide caption/device.",
    usage: "pnpm storecanvas remove-element --element <id> [--screen <n>] [options]",
    flags: [
      { name: "--element", value: "id", description: "Layer id, e.g. caption, device, text:headline, artwork:hero.", required: true },
      { name: "--screen", value: "1-10", description: "One-based screen; omit to use the first match." },
      DEVICE_FLAG,
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: ["pnpm storecanvas remove-element --screen 8 --element text:privacy-note --json"],
  },
  {
    name: "generate-background", aliases: ["background"], summary: "Generate AI connected artwork across 1-10 adjacent screens.",
    usage: "pnpm storecanvas generate-background --prompt <text> --slots <1-10> [options]",
    flags: [
      { name: "--prompt", value: "text", description: "Text-free visual direction for the image provider.", required: true },
      { name: "--slots", value: "1-10", description: "Number of adjacent screens covered." },
      { name: "--start-slot", value: "1-10", description: "First screen in the range (default 1)." },
      { name: "--template", value: "id", description: "Apply this template before generating." },
      { name: "--tone", value: "light|dark|mixed", description: "Overall tone; otherwise inferred from the deck." },
      { name: "--tone-pattern", value: "csv", description: "Example: light,dark,light,dark." },
      { name: "--model", value: "id", description: "Image model (default gpt-image-2)." },
      { name: "--api-key-env", value: "name", description: "Env var holding the provider key (default OPENAI_API_KEY)." },
      { name: "--artwork-id", value: "id", description: "Stable id to replace on later runs." },
      DEVICE_FLAG,
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: ['OPENAI_API_KEY=... pnpm storecanvas generate-background --slots 10 --prompt "Warm dusk horizon" --json'],
  },
  {
    name: "set-background", aliases: [], summary: "Place an existing image as connected artwork across 1-10 screens.",
    usage: "pnpm storecanvas set-background --image <file> --slots <1-10> [--start-slot n] [--artwork-id id]",
    flags: [
      { name: "--image", value: "file", description: "png, jpg or webp file.", required: true },
      { name: "--slots", value: "1-10", description: "Number of adjacent screens covered." },
      { name: "--start-slot", value: "1-10", description: "First screen in the range (default 1)." },
      { name: "--artwork-id", value: "id", description: "Stable id to replace on later runs." },
      DEVICE_FLAG,
      ...WRITE_FLAGS,
    ],
    needsApp: true, writes: true,
    examples: ["pnpm storecanvas set-background --image ~/Downloads/bg.png --slots 10 --json"],
  },
  {
    name: "render", aliases: [], summary: "Export PNGs with Playwright from the running app.",
    usage: "pnpm storecanvas render [--all] [--device <d>] [--locale <l>] [--output <dir>]",
    flags: [
      { name: "--all", description: "Every configured locale and device deck." },
      DEVICE_FLAG,
      LOCALE_FLAG,
      { name: "--output", value: "dir", description: "Output directory (default exports/rendered)." },
    ],
    needsApp: true, writes: false,
    examples: ["pnpm storecanvas render --device iphone --locale en-US --output exports/rendered"],
  },
  {
    name: "help", aliases: ["commands"], summary: "Show help; `help <command>` for one command, `help --json` for a machine manifest.",
    usage: "pnpm storecanvas help [command] [--json]", flags: [], needsApp: false, writes: false,
    examples: ["pnpm storecanvas help edit-screen", "pnpm storecanvas help --json"],
  },
];

const TYPICAL_FLOW = [
  "inspect                      what project, device, locales and decks exist",
  "screens --json               every screen's id, layout, copy and screenshot",
  "edit-screen / apply-template change copy, layout, screenshots or the whole deck",
  "set-project                  switch device, orientation, locale or palette",
  "validate                     fix errors before export",
  "render                       export PNGs",
];

function findCommand(name) {
  return COMMANDS.find((command) => command.name === name || command.aliases.includes(name));
}

function formatFlag(flag) {
  const label = `${flag.name}${flag.value ? ` <${flag.value}>` : ""}${flag.required ? " (required)" : ""}`;
  return `  ${label.padEnd(34)} ${flag.description}`;
}

function commandHelpText(command) {
  const lines = [`${command.name} — ${command.summary}`, "", `Usage:\n  ${command.usage}`];
  if (command.aliases.length) lines.push("", `Aliases: ${command.aliases.join(", ")}`);
  lines.push("", "Flags:", ...[...command.flags, ...COMMON_FLAGS].map(formatFlag));
  lines.push("", "Examples:", ...command.examples.map((example) => `  ${example}`));
  lines.push("", command.needsApp
    ? `Needs the app running (${baseUrl}); ${command.writes ? "writes the project file." : "does not write."}`
    : "Works offline (no app needed).");
  return lines.join("\n");
}

function helpText() {
  const width = Math.max(...COMMANDS.map((command) => command.name.length)) + 2;
  return [
    "StoreCanvas agent CLI",
    "",
    "Commands:",
    ...COMMANDS.map((command) => `  ${command.name.padEnd(width)}${command.summary}`),
    "",
    "Typical flow:",
    ...TYPICAL_FLOW.map((line, index) => `  ${index + 1}. ${line}`),
    "",
    "Global flags:",
    ...COMMON_FLAGS.map(formatFlag),
    "  Mutating commands also take --dry-run, --no-backup, --no-sync-app.",
    "",
    "Run `pnpm storecanvas help <command>` (or `<command> --help`) for flags and examples.",
    "Commands marked needsApp require the local app: pnpm dev -p 3100 (override with STORECANVAS_URL).",
  ].join("\n");
}

function helpManifest() {
  return {
    commands: COMMANDS.map(({ name, aliases, summary, usage, flags, examples, needsApp, writes }) => ({
      name, aliases, summary, usage, flags: [...flags, ...COMMON_FLAGS], examples, needsApp, writes,
    })),
    typicalFlow: TYPICAL_FLOW,
  };
}

function helpCommand(topic) {
  if (jsonOutput() && !topic) {
    output(helpManifest());
    return;
  }
  if (topic) {
    const command = findCommand(topic);
    if (!command) throw suggestCommand(topic);
    if (jsonOutput()) {
      output(helpManifest().commands.find((entry) => entry.name === command.name));
      return;
    }
    console.log(commandHelpText(command));
    return;
  }
  console.log(helpText());
}

function levenshtein(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const row = [i];
    for (let j = 1; j <= b.length; j += 1) {
      row[j] = Math.min(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    previous = row;
  }
  return previous[b.length];
}

function suggestCommand(name) {
  const names = COMMANDS.flatMap((command) => [command.name, ...command.aliases]);
  const best = names
    .map((candidate) => ({ candidate, distance: levenshtein(name, candidate) }))
    .sort((left, right) => left.distance - right.distance)[0];
  const close = best && best.distance <= Math.max(2, Math.floor(name.length / 2));
  return new CliError(
    `Unknown command: ${name}.`,
    close ? `Did you mean "${best.candidate}"? Run pnpm storecanvas help to list commands.` : "Run pnpm storecanvas help to list commands.",
  );
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

function startAppHint() {
  const port = new URL(baseUrl).port || "3100";
  return process.env.STORECANVAS_URL
    ? `Start the app: pnpm dev -p ${port} (or fix STORECANVAS_URL=${process.env.STORECANVAS_URL}).`
    : "Start the app: pnpm dev -p 3100";
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
      throw new CliError(`StoreCanvas agent request timed out at ${baseUrl}.`, startAppHint());
    }
    if (error instanceof TypeError) {
      throw new CliError(`Could not reach StoreCanvas at ${baseUrl}.`, startAppHint());
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function hydrateProject(project) {
  try {
    const payload = await agentRequest("POST", "/api/agent", { action: "inspect", project });
    return payload.state || project;
  } catch {
    // Offline inspection and JSON-only workflows still work without the app.
    return project;
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
  const project = await hydrateProject(await loadProject(projectFile));
  const summary = summarizeProject(project, projectFile);
  output(summary, `${summary.appName} · ${summary.device} · ${summary.orientation}\n${Object.entries(summary.decks).map(([device, deck]) => `  ${device}: ${deck.screens} screens, ${deck.connectedArtworks.length} connected artwork`).join("\n")}\nNext: screens --json (list copy and screenshots) · edit-screen --screen 1 --headline "..." · apply-template --template <id> · validate`);
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

function removeElementLocally(project, device, elementId, screenIndex) {
  const slides = project.slidesByDevice?.[device];
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new Error(`The ${device} deck has no screens.`);
  }
  if (screenIndex !== undefined && (screenIndex < 0 || screenIndex >= slides.length)) {
    throw new Error(`--screen must be an integer from 1 to ${slides.length}.`);
  }

  const indexes = screenIndex === undefined
    ? slides.map((_, index) => index)
    : [screenIndex];
  for (const index of indexes) {
    const slide = slides[index];
    if (["caption", "device", "deviceSecondary"].includes(elementId)) {
      const hidden = Array.isArray(slide.hiddenElements) ? slide.hiddenElements : [];
      if (hidden.includes(elementId)) continue;
      const nextSlide = { ...slide, hiddenElements: [...hidden, elementId] };
      return {
        state: {
          ...project,
          slidesByDevice: {
            ...project.slidesByDevice,
            [device]: slides.map((candidate, candidateIndex) => candidateIndex === index ? nextSlide : candidate),
          },
        },
        action: "hidden",
        screenIndex: index,
      };
    }

    const collection = elementId.startsWith("text:")
      ? "textElements"
      : elementId.startsWith("artwork:")
        ? "connectedArtworks"
        : elementId.startsWith("slot:")
          ? "deviceSlots"
          : null;
    if (!collection) throw new Error(`Unsupported element id: ${elementId}`);
    const key = elementId.slice(elementId.indexOf(":") + 1);
    const elements = Array.isArray(slide[collection]) ? slide[collection] : [];
    if (!elements.some((element) => element.id === key)) continue;
    const remaining = elements.filter((element) => element.id !== key);
    const nextSlide = { ...slide, [collection]: remaining.length ? remaining : undefined };
    return {
      state: {
        ...project,
        slidesByDevice: {
          ...project.slidesByDevice,
          [device]: slides.map((candidate, candidateIndex) => candidateIndex === index ? nextSlide : candidate),
        },
      },
      action: "removed",
      screenIndex: index,
    };
  }

  throw new Error(`Element ${elementId} was not found in the ${device} deck.`);
}

async function removeElementCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const elementId = requiredArg("--element", "--element <id> is required");
  const device = arg("--device", project.device);
  if (!SUPPORTED_DEVICES.has(device)) throw new Error(`Unsupported device: ${device}`);
  const rawScreen = arg("--screen");
  const screenIndex = rawScreen === undefined
    ? undefined
    : integerArg("--screen", 1, { min: 1, max: 10 }) - 1;
  const plan = removeElementLocally(project, device, elementId, screenIndex);
  const result = {
    command: "remove-element",
    projectFile,
    device,
    elementId,
    screen: plan.screenIndex + 1,
    action: plan.action,
    dryRun: hasFlag("--dry-run"),
  };
  if (!hasFlag("--dry-run")) {
    const response = await agentRequest("POST", "/api/agent", {
      action: "remove-element",
      project,
      device,
      elementId,
      screenIndex: plan.screenIndex,
    });
    result.summary = response.summary;
    Object.assign(result, await persistProject(projectFile, response.state));
  }
  output(result, `${result.dryRun ? "Would remove" : "Removed"} ${elementId} on ${device} screen ${result.screen}${result.backup ? ` · backup ${result.backup}` : ""}`);
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

async function setBackgroundCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const imageFile = requiredArg("--image", "--image <path to a png, jpg or webp> is required");
  const device = arg("--device", project.device);
  if (!SUPPORTED_DEVICES.has(device)) throw new Error(`Unsupported device: ${device}`);
  const spanSlots = integerArg("--slots", 2, { min: 1, max: 10 });
  const startSlot = integerArg("--start-slot", 1, { min: 1, max: 10 });
  const deckLength = Array.isArray(project.slidesByDevice?.[device]) ? project.slidesByDevice[device].length : 0;
  if (startSlot + spanSlots - 1 > deckLength) {
    throw new Error(`Artwork range ${startSlot}–${startSlot + spanSlots - 1} exceeds the ${device} deck (${deckLength} screens).`);
  }
  const extension = path.extname(imageFile).toLowerCase();
  const mime = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" }[extension];
  if (!mime) throw new Error("--image must be a .png, .jpg, .jpeg or .webp file.");
  const plan = {
    command: "set-background",
    projectFile,
    device,
    startSlot,
    spanSlots,
    source: path.resolve(imageFile),
    artworkId: arg("--artwork-id") || `background-${startSlot}-${spanSlots}`,
  };
  if (hasFlag("--dry-run")) {
    output({ ...plan, dryRun: true }, `Would place ${plan.source} across slots ${startSlot}–${startSlot + spanSlots - 1}`);
    return;
  }

  const localImage = await saveGeneratedBytes(await fs.readFile(imageFile), mime);
  const response = await agentRequest("POST", "/api/agent", {
    action: "set-background",
    project,
    device,
    startSlot,
    spanSlots,
    image: localImage,
    artworkId: plan.artworkId,
  });
  const result = {
    ...plan,
    image: localImage,
    dryRun: false,
    summary: response.summary,
    ...(await persistProject(projectFile, response.state)),
  };
  output(result, `Placed ${localImage} across slots ${startSlot}–${startSlot + spanSlots - 1}${result.backup ? ` · backup ${result.backup}` : ""}`);
}

// Mirrors pickText in src/lib/locale.ts: locale, then en, then the first non-empty value.
function pickText(field, locale) {
  if (!field || typeof field !== "object") return typeof field === "string" ? field : "";
  if (field[locale]) return field[locale];
  if (field.en) return field.en;
  return Object.values(field).find((value) => value) || "";
}

// Mirrors resolveAssetPath in src/lib/asset-library.ts.
function resolveScreenshotPath(slide, project, locale, secondary = false) {
  const ref = secondary ? slide.assetRefSecondary || slide.assetRef : slide.assetRef;
  const paths = ref ? project.assets?.[ref]?.paths : undefined;
  const fromAsset = paths ? paths[locale] || paths.en || paths["en-US"] || Object.values(paths)[0] : "";
  const fallback = secondary ? slide.screenshotSecondary : slide.screenshot;
  return (fromAsset || fallback || "").replace(/\{locale\}/g, locale);
}

function deckFor(project, device) {
  if (!SUPPORTED_DEVICES.has(device)) {
    throw new CliError(`Unsupported device: ${device}.`, `Valid devices: ${[...SUPPORTED_DEVICES].join(", ")}.`);
  }
  const slides = project.slidesByDevice?.[device];
  if (!Array.isArray(slides) || slides.length === 0) {
    throw new CliError(`The ${device} deck has no screens.`, "Run pnpm storecanvas inspect to see which decks have screens.");
  }
  return slides;
}

function checkLocale(project, locale) {
  const locales = project.locales || [];
  if (!locales.includes(locale)) {
    throw new CliError(`Unknown locale: ${locale}.`, `Project locales: ${locales.join(", ")}.`);
  }
}

async function screensCommand() {
  const projectFile = resolveProjectFile();
  const project = await hydrateProject(await loadProject(projectFile));
  const device = arg("--device", project.device);
  const locale = arg("--locale", project.locale);
  checkLocale(project, locale);
  const slides = deckFor(project, device);
  const screens = slides.map((slide, index) => ({
    screen: index + 1,
    id: slide.id,
    layout: slide.layout,
    label: pickText(slide.label, locale),
    headline: pickText(slide.headline, locale),
    screenshot: resolveScreenshotPath(slide, project, locale),
    connectedArtworks: (slide.connectedArtworks || []).map((artwork) => artwork.id),
    hiddenElements: slide.hiddenElements || [],
  }));
  const human = [
    `${project.appName} · ${device} · ${locale} · ${screens.length} screens`,
    ...screens.map((screen) => [
      `${String(screen.screen).padStart(2)}. ${screen.layout.padEnd(13)} ${JSON.stringify(screen.headline)}${screen.label ? ` [${screen.label}]` : ""}`,
      `\n      ${screen.screenshot || "(no screenshot)"}`,
      screen.connectedArtworks.length ? ` · artwork: ${screen.connectedArtworks.join(", ")}` : "",
      screen.hiddenElements.length ? ` · hidden: ${screen.hiddenElements.join(", ")}` : "",
    ].join("")),
  ].join("\n");
  output({ projectFile, device, locale, screens }, human);
}

const IMAGE_MIME = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp" };

function imageMime(flag, file) {
  const mime = IMAGE_MIME[path.extname(file).toLowerCase()];
  if (!mime) throw new CliError(`${flag} must be a .png, .jpg, .jpeg or .webp file.`);
  return mime;
}

async function editScreenCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const device = arg("--device", project.device);
  const slides = deckFor(project, device);
  if (!arg("--screen")) throw new CliError("--screen <n> is required.", `Screens are numbered 1-${slides.length}; run pnpm storecanvas screens to list them.`);
  const screen = integerArg("--screen", 1, { min: 1, max: slides.length });
  const locale = arg("--locale", project.locale);
  checkLocale(project, locale);
  const headline = textArg("--headline");
  const label = textArg("--label");
  const layout = arg("--layout");
  const image = arg("--image");
  const secondaryImage = arg("--secondary-image");
  if ([headline, label, layout, image, secondaryImage].every((value) => value === undefined)) {
    throw new CliError(
      "edit-screen needs at least one change: --headline, --label, --layout, --image or --secondary-image.",
      'Example: pnpm storecanvas edit-screen --screen 1 --headline "New headline"',
    );
  }
  if (layout !== undefined && !LAYOUTS.includes(layout)) {
    throw new CliError(`Unknown layout: ${layout}.`, `Valid layouts: ${LAYOUTS.join(", ")}.`);
  }
  const mimes = {};
  for (const [flag, file] of [["--image", image], ["--secondary-image", secondaryImage]]) {
    if (file === undefined) continue;
    mimes[flag] = imageMime(flag, file);
    if (!existsSync(file)) throw new CliError(`${flag} file not found: ${path.resolve(file)}`);
  }

  const plan = {
    command: "edit-screen",
    projectFile,
    device,
    screen,
    screenId: slides[screen - 1].id,
    locale,
    changes: {
      ...(headline !== undefined && { headline }),
      ...(label !== undefined && { label }),
      ...(layout !== undefined && { layout }),
      ...(image !== undefined && { image: path.resolve(image) }),
      ...(secondaryImage !== undefined && { secondaryImage: path.resolve(secondaryImage) }),
    },
    dryRun: hasFlag("--dry-run"),
  };
  const describe = `${Object.keys(plan.changes).join(", ")} on ${device} screen ${screen} (${locale})`;
  if (plan.dryRun) {
    output(plan, `Would change ${describe}`);
    return;
  }

  const screenshot = image ? await saveGeneratedBytes(await fs.readFile(image), mimes["--image"]) : undefined;
  const screenshotSecondary = secondaryImage ? await saveGeneratedBytes(await fs.readFile(secondaryImage), mimes["--secondary-image"]) : undefined;
  const response = await agentRequest("POST", "/api/agent", {
    action: "edit-screen",
    project,
    device,
    screenIndex: screen - 1,
    locale,
    headline,
    label,
    layout,
    screenshot,
    screenshotSecondary,
  });
  const result = {
    ...plan,
    changes: { ...plan.changes, ...(screenshot && { image: screenshot }), ...(screenshotSecondary && { secondaryImage: screenshotSecondary }) },
    summary: response.summary,
    ...(await persistProject(projectFile, response.state)),
  };
  output(result, `Changed ${describe}${result.backup ? ` · backup ${result.backup}` : ""}`);
}

function onOffArg(name) {
  const value = arg(name);
  if (value === undefined) return undefined;
  if (!["on", "off"].includes(value)) throw new CliError(`${name} must be on or off.`);
  return value === "on";
}

async function setProjectCommand() {
  const projectFile = resolveProjectFile();
  const project = await loadProject(projectFile);
  const device = arg("--device");
  const orientation = arg("--orientation");
  const locale = arg("--locale");
  const appName = arg("--app-name");
  const paletteId = arg("--palette");
  const connectedCanvas = onOffArg("--connected");
  if ([device, orientation, locale, appName, paletteId, connectedCanvas].every((value) => value === undefined)) {
    throw new CliError(
      "set-project needs at least one change: --device, --orientation, --locale, --app-name, --palette or --connected.",
      "Example: pnpm storecanvas set-project --device ipad --orientation landscape",
    );
  }
  if (device !== undefined && !SUPPORTED_DEVICES.has(device)) {
    throw new CliError(`Unsupported device: ${device}.`, `Valid devices: ${[...SUPPORTED_DEVICES].join(", ")}.`);
  }
  if (orientation !== undefined && !["portrait", "landscape"].includes(orientation)) {
    throw new CliError("--orientation must be portrait or landscape.");
  }
  const finalDevice = device ?? project.device;
  const finalOrientation = orientation ?? project.orientation;
  if (finalOrientation === "landscape" && !landscapeSizes[finalDevice]) {
    throw new CliError(
      `${finalDevice} does not support landscape.`,
      `Landscape devices: ${Object.keys(landscapeSizes).join(", ")}. Pass --orientation portrait to switch back.`,
    );
  }
  if (locale !== undefined) checkLocale(project, locale);
  const response = await agentRequest("POST", "/api/agent", {
    action: "set-project",
    project,
    device,
    orientation,
    locale,
    appName,
    paletteId,
    connectedCanvas,
  });
  const result = {
    command: "set-project",
    projectFile,
    changes: response.changes,
    dryRun: hasFlag("--dry-run"),
    summary: response.summary,
  };
  if (!result.dryRun) Object.assign(result, await persistProject(projectFile, response.state));
  output(result, `${result.dryRun ? "Would update" : "Updated"} ${response.changes.join(", ")}${result.backup ? ` · backup ${result.backup}` : ""}`);
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

function exportSizesFor(project, device, orientation) {
  const catalog = orientation === "landscape"
    ? landscapeSizes[device] || defaultSizes[device]
    : defaultSizes[device];
  if (!catalog) return undefined;
  const requested = project.exportSizeIds?.[device];
  if (!Array.isArray(requested) || requested.length === 0) return catalog.slice(0, 1);
  const requestedClasses = new Set(requested.map(sizeClassId));
  const selected = catalog.filter((size) => requestedClasses.has(sizeClassId(size.id)));
  return selected.length > 0 ? selected : catalog.slice(0, 1);
}

async function renderCommand() {
  const { chromium } = await import("@playwright/test");
  let project = await hydrateProject(await loadProject(resolveProjectFile()));
  if (!hasFlag("--no-sync-app")) {
    try {
      const response = await agentRequest("POST", "/api/project", project);
      project = response.state || project;
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
      const sizes = exportSizesFor(project, device, orientation);
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

function hintFor(error) {
  if (error instanceof CliError && error.hint) return error.hint;
  const message = error instanceof Error ? error.message : String(error);
  if (/Unknown (campaign template|palette)/i.test(message)) {
    return "Run pnpm storecanvas catalog --json to list valid template and palette ids.";
  }
  return undefined;
}

async function main() {
  // pnpm/npm may preserve the separator when the command is invoked through a
  // package script (`pnpm run storecanvas -- inspect`). Accept both forms so
  // agents can use the documented bin or the package script interchangeably.
  const commandIndex = process.argv[2] === "--" ? 3 : 2;
  const first = process.argv[commandIndex];
  const command = !first || first === "--help" || first === "--json" ? "help" : first;
  if (command === "help" || command === "commands") {
    const topic = process.argv[commandIndex + 1];
    return helpCommand(topic && !topic.startsWith("--") ? topic : undefined);
  }
  const known = findCommand(command);
  if (!known) throw suggestCommand(command);
  if (hasFlag("--help")) return helpCommand(known.name);
  switch (known.name) {
    case "catalog": return catalogCommand();
    case "inspect": return inspectCommand();
    case "screens": return screensCommand();
    case "edit-screen": return editScreenCommand();
    case "set-project": return setProjectCommand();
    case "validate": return validateCommand();
    case "apply-template": return applyTemplateCommand();
    case "remove-element": return removeElementCommand();
    case "generate-background": return generateBackgroundCommand();
    case "set-background": return setBackgroundCommand();
    case "render": return renderCommand();
    default: throw suggestCommand(command);
  }
}

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  const hint = hintFor(error);
  if (jsonOutput()) console.log(JSON.stringify({ ok: false, error: message, ...(hint && { hint }) }, null, 2));
  else console.error(`Error: ${message}${hint ? `\nHint: ${hint}` : ""}`);
  process.exitCode = 1;
});
