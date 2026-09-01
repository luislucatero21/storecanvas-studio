# StoreCanvas

[![CI](https://github.com/luislucatero21/storecanvas-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/luislucatero21/storecanvas-studio/actions/workflows/ci.yml)
[![Live demo](https://img.shields.io/badge/demo-Vercel-000000?logo=vercel&logoColor=white)](https://storecanvas-studio.vercel.app/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

## Build store screenshots that read like a product story

StoreCanvas is a free, open-source, local-first studio for turning real mobile-app captures into App Store and Google Play campaign assets. Compose a sequence where one visual idea can continue into the next frame, then export deterministic, store-sized images without giving your project to a hosted design platform.

**[Open the live Vercel demo](https://storecanvas-studio.vercel.app/)** · **[Read the architecture](docs/architecture.md)** · **[Contribute](CONTRIBUTING.md)**

The public demo starts from a neutral, checked-in example. Your local projects, screenshots, generated backgrounds, and browser edits are not uploaded automatically.

## Why StoreCanvas?

Most screenshot tools treat each frame as a separate poster. StoreCanvas treats the campaign as a visual sequence:

| | StoreCanvas approach |
| --- | --- |
| **Story** | Connected captions and artwork can span up to ten adjacent screens while keeping each slot editable. |
| **Real product UI** | Use your actual captures inside hardware-aware iPhone, iPad, and Android frames. |
| **Precision** | Device slots are independent by default; shared transforms and copy continuity are explicit opt-ins. |
| **Ownership** | Projects live in browser storage or an explicitly configured local JSON file. Vercel stays read-only and needs no remote database. |
| **No lock-in** | Export PNGs or a JSON backup. Optional AI uses a key you provide for the current session; StoreCanvas has no accounts, plans, checkout, or usage meter. |

## Quick start

Requirements: Node.js `>=22.13.0` and pnpm `11.9.0`.

```bash
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000). If the ignored `app-store-screenshots.json` exists in the local checkout, the editor discovers it and loads it automatically on first use. Otherwise, it loads `example-project.json` as a safe seed. Changes are autosaved to the browser-local project library.

For a clean checkout, the first UI-test run also needs Chromium:

```bash
pnpm exec playwright install chromium
```

### Local projects and Vercel

Use the visible **Project** selector to create campaigns, switch between local projects, import a JSON backup, or download a backup. In local development, the ignored `app-store-screenshots.json` is auto-discovered without an import step. To also write edits back to a specific local file, create `.env.local`:

```bash
STORECANVAS_PROJECT_FILE=app-store-screenshots.json
```

The private filename, uploaded screenshots, generated backgrounds, and exports are ignored by Git. The checked-in example is never overwritten by default. A Vercel page cannot read a developer's `localhost` filesystem, so moving a project between origins requires a one-time JSON import; after that, browser storage restores it on that origin.

## Build a campaign

1. Choose or create a project from **Project**.
2. Add real captures by dropping files into the inspector, choosing a checked-in fixture, or importing public App Store metadata.
3. Select a template and palette. Manual placement, custom tokens, and connected artwork remain untouched unless the corresponding reset/reflow option is enabled.
4. Arrange copy, device slots, hardware model, camera angle, crop, visibility, and locking on the canvas.
5. Export the selected locale/device deck or use the CLI for repeatable render jobs.

### Explore the checked-in demo

The starter campaign is deliberately self-contained so the visual system is visible before importing any app:

- Screens 1–2 open with a two-screen orbit, shared headline, an iPhone 17 Pro Max, and two independently angled companion models.
- Screens 4–5 show connected artwork plus a large caption, a safe independent slot, and an explicitly linked slot repeated across the seam.
- Screens 8–9 keep a second shared-caption example available for testing contrast and positioning.

Select **Connected** in the toolbar, then click those thumbnails to inspect each composition and its opt-in controls. The neutral captures and backgrounds live in [`public/screenshots/demo`](public/screenshots/demo) and [`public/backgrounds`](public/backgrounds); no personal campaign assets are needed.

## What is included

- Connected or isolated canvas composition with exact export-time crops.
- Captions and artwork that span up to ten screens with per-slot contrast controls and light/dark surface guidance.
- Independent device slots, plus explicit opt-in transform linking when repeated captures should move together.
- iPhone 17 Pro Max, iPhone 14 Pro Max, and iPhone 13 Pro Max frames with Dynamic Island/cutout and physical controls.
- Flat, optical-tilt, low-angle, high-angle, and custom camera controls.
- Ten campaign templates and twelve palette presets, with custom brand tokens and accessible contrast guidance.
- Per-slide text layers, responsive constraints, hiding/locking, undo/redo, multiple locales, and JSON backups.
- App Store URL import that creates a project-owned template, palette, and copy direction from listing metadata and screenshot color signals. Published composites stay reference-only unless the user opts into using them as captures.
- Optional bring-your-own-key copy polish through OpenAI or OpenRouter, plus connected-artwork generation through OpenAI. Choose 1–10 covered screens; the API prompt receives the requested span and light/dark tone pattern. Keys remain in memory for the current dialog session.
- Deterministic Playwright rendering for exact storefront sizes and a CLI that can render every configured locale/device deck.

## Privacy and asset rights

StoreCanvas does not operate a hosted project database, account system, telemetry pipeline, billing flow, or usage meter. Local browser storage is the canonical library; local file sync is explicit; Vercel writes are disabled. AI requests go only to the provider selected by the user and may have that provider's own cost or terms.

The repository contains only neutral, self-authored demo SVGs. App Store metadata, screenshots, app icons, logos, and downloaded/generated assets may belong to someone else. Only redistribute assets for which you have permission, and keep private campaign material in ignored paths.

## Rendering from the command line

Start the dev server, then run:

```bash
pnpm storecanvas render --device iphone --locale en-US --output exports/rendered
```

Use `--all` to render every configured locale and device deck with screens. Set `STORECANVAS_URL` when the server is not at `http://127.0.0.1:3100`. The renderer reads the same `STORECANVAS_PROJECT_FILE` setting as the editor.

## Development and quality gates

```bash
pnpm typecheck
pnpm test       # Vitest unit tests
pnpm test:ui    # Playwright UI tests
pnpm test:all
pnpm build
pnpm audit --audit-level high
```

CI runs dependency audit, typecheck, 42 unit tests, Playwright browser tests, and a production build on pushes and pull requests to `main`. See [CONTRIBUTING.md](CONTRIBUTING.md) for the contribution workflow and [docs/OPEN_SOURCE_AUDIT.md](docs/OPEN_SOURCE_AUDIT.md) for the current audit snapshot.

## Project map

| Path | Purpose |
| --- | --- |
| `example-project.json` | Safe, checked-in demo campaign |
| `src/lib/defaults.ts` | Blank fallback/reset state |
| `src/lib/project-file.ts` | Configurable and auto-discovered local project resolution |
| `src/components/editor/` | Editor UI, canvas, frames, project selector, and inspectors |
| `src/lib/campaign-presets.ts` | Templates and palette presets |
| `src/app/render/` | Server-rendered deterministic export surface |
| `scripts/storecanvas.mjs` | Playwright export CLI |
| `tests/` | Unit and UI regression suites |

## Open-source docs

- [Contributing](CONTRIBUTING.md) · [Code of Conduct](CODE_OF_CONDUCT.md) · [Support](SUPPORT.md)
- [Security policy](SECURITY.md) · [Architecture](docs/architecture.md) · [Roadmap](ROADMAP.md)
- [Changelog](CHANGELOG.md) · [Open-source audit](docs/OPEN_SOURCE_AUDIT.md) · [Citation](CITATION.cff)
- [Third-party open-source attribution](THIRD_PARTY.md)

StoreCanvas is not affiliated with Apple, Google, Vercel, OpenAI, or any app whose assets a user imports.

### Connected artwork API

`POST /api/ai/image` accepts `spanSlots` from `1` to `10`, plus optional `tone` (`light`, `dark`, or `mixed`) and `tonePattern` (an ordered array of light/dark surfaces). The server adds those constraints to the image prompt, sends the request directly to OpenAI, and saves the returned image only in the local upload path. The API key is request-scoped and never written to project JSON or browser storage.

## License

Copyright (c) 2026 Luis Lucatero. Source code and the included demo assets are available under the [MIT License](LICENSE).
