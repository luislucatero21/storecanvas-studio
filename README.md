# StoreCanvas — Campaign studio

Local-first screenshot composition studio for turning real app captures into App Store and Google Play campaign assets. The starter project is wired to the current Rutmia capture deck.

## Quick start

```bash
bun install   # or pnpm / yarn / npm
bun dev       # http://localhost:3000
```

Open `http://localhost:3000` and edit the campaign. Changes autosave to `app-store-screenshots.json` and to the browser cache.

## What's inside

- **Connected canvas editor** (`src/components/editor/`) — every screen sits on one horizontal canvas, so phones, captions, and other elements can be dragged across screen boundaries and exported as split crops when Connected mode is enabled.
- **Campaign wardrobe** — twelve composition templates and twelve AA-checked palettes can be applied without replacing screenshot files, semantic capture IDs, localized copy, or custom text layers. Templates automatically reflow connected artwork; replacing the palette or manual placement is explicitly opt-in. The Tune panel adjusts six core color tokens with a live preview and contrast score.
- **AI polish** — review copy suggestions from a personal OpenAI or OpenRouter key before applying them. Keys are held only in the dialog session and never written to the project file. The request contains app/copy context only—never capture files or their paths.
- **Screen controls** — drag-to-reorder screens, click-to-edit text, screenshot drop targets, per-screen layout switcher, layer ordering, hide/lock controls, and responsive anchors.
- **Device frames** (`src/components/editor/device-frames.tsx`) — selectable iPhone hardware models with their own cutout and controls, plus iPad, Android phone, Android tablet (portrait + landscape), and feature graphic.
- **3D camera rig** — every phone or tablet can use flat, left/right tilt, low-angle, high-angle, or fine-tuned perspective/depth controls. The same rig works through iPhone, iPad, Android phone, and Android tablet frames.
- **Face-forward editorial layers** — hardware and captured screens move together in 3D, while headlines, labels, and custom copy remain on the artboard plane for consistent readability.
- **Connected artwork** — upload or generate one text-free panorama that crosses two or three screens while remaining a separately editable low-z layer. OpenAI GPT Image and a managed platform image endpoint are supported; personal keys are never stored.
- **Reusable device slots** — add two or more devices, reuse the same semantic capture with independent angle/position by default, or explicitly opt into one linked transform across two or three artboards.
- **Cross-screen messages** — captions can span one, two, or three connected screens for large horizontal statements.
- **Optional copy continuity** — link matching screen positions so localized labels and headlines stay identical across iPhone, iPad, Android, and tablet decks; unlink at any time to resume device-specific copy.
- **Semantic capture library** — slides reference stable IDs such as `capture:home-dashboard`; locale-specific paths can be refreshed without changing composition transforms.
- **Preflight QA** — the toolbar validates schema, locale, store slide limits, export targets, and screenshot availability before allowing production export.
- **Auto-save (git-trackable)** — every change is persisted within ~600ms to **`app-store-screenshots.json`** at the project root (via `/api/project`) **and** mirrored to `localStorage` as an instant-paint cache. Commit `app-store-screenshots.json` and you can `git clone` to another machine and resume exactly where you left off.
- **Multi-device decks** — iOS and Android slide decks live side by side; switching the platform tab preserves both.
- **Native iPad campaign** — the Rutmia starter includes six real 2064×2752 iPad captures in English and Spanish, generated from deterministic XCUITest marketing journeys.
- **One-click export** — bulk PNG export at every configured store resolution using `html-to-image`; each PNG is rendered from the current connected or isolated deck mode.
- **Deterministic renderer** — `pnpm storecanvas render --device iphone --locale en-US --output exports/rendered` captures exact-size PNGs from `/render` with Playwright.
- **Project migration** — older `app-store-screenshots.json` files are migrated on load. Existing per-slide transforms remain valid, and connected crops become available without rewriting the deck by hand.
- **Legacy-safe mode** — pre-v2 projects opened directly in the editor start in isolated-screen mode first, then can opt into connected crops with the toolbar's Connected/Isolated control. Skill-run in-place migrations keep legacy decks isolated unless the project had already explicitly opted into connected canvas.

## Adding screenshots

Two ways:

1. **Drop a file in the inspector** — drag-and-drop or click Pick. The file is sent to `/api/upload`, hashed, and written to `public/screenshots/uploaded/<hash>.png`. The slide stores the resulting `/screenshots/uploaded/...` path, so commit those files alongside `app-store-screenshots.json` and the screenshots survive a `git clone`.
2. **Reference a static file** — put PNGs under `public/screenshots/{platform}/{device}/{locale}/` and reference them by path. Default sample slides expect:
   - `public/screenshots/apple/iphone/en/...`
   - `public/screenshots/android/phone/en/...`
   - `public/screenshots/apple/ipad/en/...`

Update the matching `screenshot` fields in `app-store-screenshots.json` to point at whatever filenames you choose.

## Exporting

The toolbar dropdown lists every Apple/Google-required size for the current device. Click **Export bundle** to download a zip. In Connected mode, each PNG is clipped from the connected canvas, so an element that straddles two screens appears split exactly where you placed it. In Isolated mode, each screen clips its own elements and legacy offscreen content cannot leak into neighboring exports.

For repeatable CLI output, start the dev server and run:

```bash
pnpm storecanvas render --device iphone --locale en-US --output exports/rutmia-preview
```

Use `--all` to render every configured locale and every device deck with screens. Set `PLAYWRIGHT_EXECUTABLE_PATH` only when your local Playwright browser is installed outside its normal cache.

## Tests

```bash
pnpm typecheck
pnpm test       # Vitest unit tests
pnpm test:ui    # Playwright UI tests
pnpm test:all
```

The suites cover the Rutmia load path, locale editing, text layers, 3D iPhone/Android rendering, independent and opt-in-linked device slots, connected artwork upload/generation, template artwork reflow and opt-in overrides, cross-screen messages, linked cross-device copy, exact-size iPhone/iPad output, palette contrast, AI review, and hide/lock interactions.

## AI providers

Open **AI polish** in the toolbar and choose one of these options:

- **OpenAI / OpenRouter:** paste your own API key into the dialog and choose a model. The key exists only in memory for that dialog session; it is never put in `app-store-screenshots.json`, local storage, source control, or server logs by StoreCanvas.
- **StoreCanvas workspace:** use an OpenAI-compatible server-side gateway when you want managed usage or paid workspace credits. This is intentionally disabled until the deployment owner configures it; StoreCanvas does not pretend to provide billing on its own.

Copy `.env.example` to `.env.local` and configure these only for managed workspace AI:

```bash
STORECANVAS_PLATFORM_AI_URL=https://your-gateway.example/v1/chat/completions
STORECANVAS_PLATFORM_AI_TOKEN=server-side-secret
STORECANVAS_PLATFORM_AI_MODEL=gpt-4.1-mini
STORECANVAS_PUBLIC_URL=https://your-storecanvas.example # optional OpenRouter attribution
```

The gateway receives standard OpenAI-compatible chat-completion requests. A deployment may use it to enforce budget, users, or billing before forwarding to the actual model provider.

Connected artwork generation uses OpenAI's Images API with `gpt-image-2` by default, or a managed endpoint with the same response shape (`data[0].b64_json`) or `{ "path": "/public-path.png" }`:

```bash
STORECANVAS_PLATFORM_IMAGE_URL=https://your-gateway.example/v1/images/generations
STORECANVAS_PLATFORM_IMAGE_TOKEN=server-side-secret
STORECANVAS_PLATFORM_IMAGE_MODEL=gpt-image-2
```

## Customizing

| Where | What |
|-------|------|
| `src/lib/constants.ts` | Canvas dimensions, export sizes, frame ratios, themes, locales |
| `app-store-screenshots.json` | Canonical starter project: app name, current device, connected-canvas mode, slide copy, screenshots, and transforms |
| `src/lib/defaults.ts` | Fallback/reset state used when no project file or local cache exists |
| `src/components/editor/slide-canvas.tsx` | Add new layouts and connected-canvas element rendering |
| `src/components/editor/device-frames.tsx` | Tweak device chrome (bezel radii, camera dots) |
| `src/app/layout.tsx` | Swap the font (`next/font/google`) |

## Notes

- iPhone hardware is rendered from model definitions in `src/lib/device-models.ts`; `PHONE_SCREEN` remains the shared capture aperture.
- Image preloading converts every static path to a base64 data URI before exports run, and export retries paths that were previously missing — this prevents the html-to-image race where some slide screenshots come out black.
- Reset via the toolbar's circular arrow icon clears in-memory state and reloads the default screens. To wipe disk state too, delete `app-store-screenshots.json`.
- **Persistence model** — the canonical state lives in `app-store-screenshots.json` (git-tracked). On load, the editor reads localStorage first for instant paint, then overwrites with the file contents if present; if the file endpoint is unavailable, autosave is blocked so stale cache cannot overwrite disk. On save, both are written. If you ever see a conflict, the file always wins.
- **Migration model** — older projects do not need a manual conversion. On first load, the editor upgrades localized text and transform records, writes `schemaVersion: 5`, adds explicit campaign template/palette IDs, preserves all existing screens, and keeps legacy canvas behavior intact. Schema v5 adds selectable iPhone hardware models on top of the bounded 3D presentation values, reusable device slots, message spans, and optional copy continuity introduced previously. Turn on **Connected** in the toolbar when you want elements to cross screen edges.
- **Custom themes** — if a project file references a theme id that is not present in `src/lib/constants.ts`, the editor falls back to `clean-light` and shows a warning. Merge custom `THEMES` entries during in-place upgrades.
