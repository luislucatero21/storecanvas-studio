---
name: storecanvas-agent
description: Use the StoreCanvas CLI to inspect campaigns, choose templates and palettes, generate connected AI artwork across 1–10 screenshot slots, validate projects, and render deterministic App Store assets.
---

# StoreCanvas agent workflow

Use this skill from the StoreCanvas repository root. The CLI is the supported agent interface; it is deliberately JSON-friendly and reuses the editor's template, palette, schema, and artwork rules through the local `/api/agent` bridge.

## Start safely

1. Inspect the project before changing it:

   ```bash
   pnpm storecanvas inspect --json
   ```

   The CLI automatically selects `STORECANVAS_PROJECT_FILE`, then the ignored local `app-store-screenshots.json`, then the checked-in `example-project.json`. Use `--project path/to/project.json` when the target must be explicit.

2. Start the local app when a command needs the bridge:

   ```bash
   pnpm dev -p 3100
   ```

3. Discover valid IDs instead of inventing them:

   ```bash
   pnpm storecanvas catalog --json
   ```

## Compose a campaign

Apply a template to the selected device deck. Placement and connected-artwork reflow are opt-in through explicit flags:

```bash
pnpm storecanvas apply-template \
  --template afterglow-rhythm \
  --device iphone \
  --recommended-palette \
  --json
```

Use `--palette <id>` for a specific palette, `--reset-customizations` when manual placement should be replaced, and `--preserve-artwork` when existing connected artwork must stay where it is. Every write creates a backup under ignored `exports/backups/`; use `--dry-run` to inspect the plan without writing.

Generate one continuous, text-free background across a chosen range:

```bash
OPENAI_API_KEY="$OPENAI_API_KEY" pnpm storecanvas generate-background \
  --template afterglow-rhythm \
  --device iphone \
  --start-slot 1 \
  --slots 10 \
  --prompt "A warm dusk horizon with subtle violet and amber motion, quiet negative space for phones and headlines" \
  --artwork-id rutmia-panorama \
  --json
```

Important behavior:

- `--start-slot` is one-based and `--slots` accepts 1–10.
- `--template` applies that template before generation. Omit it to keep the current composition.
- The tonal rhythm is inferred from the deck. Override it with `--tone light|dark|mixed` or `--tone-pattern light,dark,...`.
- Reusing `--artwork-id` replaces that artwork instead of creating duplicates.
- The provider key is read from `OPENAI_API_KEY` by default, or from the variable named by `--api-key-env`; it is never written to project JSON or output.
- Generated files are materialized under ignored `public/screenshots/uploaded/` so the result works in the local editor and renderer.

## Verify and export

```bash
pnpm storecanvas validate --json
pnpm storecanvas render --device iphone --locale en-US --output exports/rendered
```

Use `--all` for every configured device and locale. The CLI syncs the selected state to the running local app before rendering, so a mutation is visible even when a browser process previously held stale in-memory state.

## Agent contract

- `GET /api/agent?view=catalog` returns protocol version, capabilities, devices, templates, and palettes.
- `POST /api/agent` supports `catalog`, `inspect`, `validate`, `apply-template`, and `generate-background`.
- Mutating API calls return a validated `state`; the CLI persists it atomically and refreshes the running local editor when available.
- The bridge is local-first and stateless. Vercel remains read-only; do not treat it as a project database.
- Keep private screenshots, app-store imports, generated artwork, API keys, and local project files out of commits.
