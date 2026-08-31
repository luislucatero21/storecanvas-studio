# StoreCanvas

StoreCanvas is a local-first studio for turning real app captures into App Store and Google Play campaign assets. It combines a connected canvas, independent device slots, editable copy, reusable templates, palettes, hardware-aware iPhone frames, deterministic exports and optional App Store metadata import.

The repository includes a neutral, shareable demo project. Your own campaign files and downloaded assets stay local by default.

## Quick start

```bash
pnpm install   # bun install also works
pnpm dev       # http://localhost:3000
```

Open `http://localhost:3000`. The editor loads `example-project.json` and autosaves changes to that file plus the browser cache.

To work on a private project without adding it to Git, create `.env.local`:

```bash
STORECANVAS_PROJECT_FILE=app-store-screenshots.json
```

`app-store-screenshots.json`, uploaded screenshots, generated backgrounds and exports are ignored by Git. This keeps private app captures out of an open-source checkout while preserving the existing local file.

## Features

- Connected or isolated screen composition with crops that remain exact at export time.
- Captions and artwork that span two or three screens.
- Independent device slots by default, with explicit opt-in transform linking.
- iPhone 17 Pro Max, iPhone 14 Pro Max and iPhone 13 Pro Max hardware frames with Dynamic Island/cutout and physical controls.
- Flat, optical tilt, low-angle, high-angle and custom camera controls.
- Twelve campaign templates and twelve accessible palette presets, with separate opt-in controls for recommended colors and placement resets.
- Direct brand-token customization, per-slide text layers, responsive constraints, hiding/locking and undo/redo.
- App Store URL import that derives a project-owned template, palette and copy suggestions from listing metadata and screenshot signals. Published composites remain reference-only unless the user explicitly enables them as captures.
- Optional connected-artwork generation through an OpenAI-compatible Images API or a managed deployment endpoint. API keys stay in the active dialog and are never written to the project file.
- Deterministic Playwright rendering for exact storefront sizes.

## Working with assets

Drop captures into the inspector or reference static files under `public/screenshots/`. The included demo uses small, self-authored SVG screens under `public/screenshots/demo/` and a text-free connected ribbon under `public/backgrounds/demo-ribbon.svg`.

For a private campaign, keep downloaded or generated assets under the ignored upload/import directories. Only redistribute assets for which you have the necessary rights. App Store listing metadata and published screenshots are third-party content; StoreCanvas does not grant permission to reuse them.

## Rendering

Start the dev server and run:

```bash
pnpm storecanvas render --device iphone --locale en-US --output exports/rendered
```

Use `--all` to render every configured locale and device deck with screens. Set `STORECANVAS_URL` when the server is not at the default address. The renderer reads the same `STORECANVAS_PROJECT_FILE` setting as the editor.

## AI providers

AI copy polish accepts a user-provided OpenAI or OpenRouter key in memory for the current dialog session. Connected artwork generation follows the same pattern. A deployment can optionally configure a server-side OpenAI-compatible gateway in `.env.local`; copy `.env.example` to get the available variables. StoreCanvas does not provide billing, key storage or a hosted proxy by itself.

## Tests

```bash
pnpm typecheck
pnpm test       # Vitest unit tests
pnpm test:ui    # Playwright UI tests
pnpm test:all
```

The suites cover schema/migration contracts, palette contrast, template reflow, shared-caption contrast and dragging, independent and linked device slots, App Store import validation, AI key handling, exact-size rendering and the main editor workflows.

## Project structure

| Path | Purpose |
|------|---------|
| `example-project.json` | Safe, checked-in demo campaign |
| `src/lib/defaults.ts` | Blank fallback/reset state |
| `src/lib/project-file.ts` | Configurable project-file resolution |
| `src/components/editor/` | Editor UI, canvas, frames and inspectors |
| `src/lib/campaign-presets.ts` | Templates and palette presets |
| `src/app/render/` | Server-rendered deterministic export surface |
| `scripts/storecanvas.mjs` | Playwright export CLI |
| `tests/` | Unit and UI regression suites |

## Open-source attribution

StoreCanvas is released under the MIT License. Direct open-source dependencies and their upstream repositories are listed in [THIRD_PARTY.md](THIRD_PARTY.md), including React, Next.js, Radix UI, dnd-kit, Playwright, Vitest, Sharp, Lucide and the other libraries used by this project.

## License

Copyright (c) 2026 Luis Lucatero.

Source code and the included demo assets are available under the [MIT License](LICENSE).
