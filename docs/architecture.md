# Architecture

StoreCanvas is a browser editor with a small Next.js server boundary. The important design decision is that project state belongs to the user, not to a hosted StoreCanvas account.

## Runtime flow

```mermaid
flowchart LR
  A[Editor UI] --> B[Project state]
  B --> C[Browser localStorage]
  B --> D{Local runtime?}
  D -->|Yes| E[/api/project]
  E --> F[Optional local JSON file]
  D -->|Vercel| G[Read-only API response]
  A --> H[Deterministic canvas/export]
  A --> I[Optional App Store import]
  A --> J[Optional BYO-key AI provider]
  K[Agent CLI] --> L[/api/agent]
  L --> M[Shared agent workflow]
  M --> B
  M --> J
```

## Main layers

- `src/components/editor/` contains the client editor, canvas, inspectors, project selector, device frames, and export workflow.
- `src/lib/types.ts` and `src/lib/schema.ts` define the project contract. `ProjectStateSchema` validates imported and persisted JSON.
- `src/lib/storage.ts` owns browser persistence, project switching, autosave, migration, and undo/redo.
- `src/lib/project-file.ts` resolves the safe checked-in example or an explicitly configured/auto-discovered local campaign file.
- `src/app/api/` contains narrow server routes for project convenience, App Store metadata/image proxying, uploads, and optional AI calls.
- `src/app/api/agent/route.ts` is a stateless JSON bridge for terminal agents. It exposes the live preset catalog and delegates composition/generation to `src/lib/agent-workflow.ts`.
- `src/app/render/` is a server-rendered export surface used by `scripts/storecanvas.mjs` for exact-size screenshots.
- `scripts/storecanvas.mjs` is the supported agent CLI. It reads/writes local JSON atomically, creates ignored backups, materializes generated artwork locally, and then renders through the same browser surface.
- `skills/storecanvas-agent/SKILL.md` gives terminal-capable agents a discoverable workflow and the safety rules for local assets and provider keys.
- `tests/` contains unit contracts; `tests/ui/` contains browser-level editor and rendering workflows.

## Persistence matrix

| Context | Source of truth | Server write behavior |
| --- | --- | --- |
| Local editor without a configured file | Browser project library | `/api/project` keeps the latest state in process memory for the current dev server |
| Local editor with `STORECANVAS_PROJECT_FILE` | Browser library plus explicit JSON sync | Writes the validated project to that local path |
| Vercel deployment | Browser project library for the current origin | API is read-only; filesystem writes are intentionally skipped |
| Checked-in repository | `example-project.json` | Safe fixture only; never overwritten by default |

Imported screenshots and generated image data can live in browser storage or ignored local directories. A Vercel deployment cannot read a developer's `localhost` filesystem; moving a project between origins requires an explicit JSON import.

## Data boundaries

1. The browser sends a validated `ProjectState` to the local project route when autosave runs.
2. The API rejects malformed project JSON with a `400` response before it can be persisted.
3. Local project-file discovery checks only the known ignored filename unless the user explicitly configures another path.
4. AI routes accept a key from the current request and proxy it to the selected provider. StoreCanvas does not put the key in project state or a hosted database.
5. App Store image imports validate the `https` protocol and Apple image host before downloading.
6. Agent mutations return a validated project state; the CLI is responsible for the explicit local-file write. The bridge itself does not create accounts, queues, databases, or durable hosted state.

These boundaries are part of the product contract. New server features should document where data lives, whether Vercel can support them, and how a user can remove or export it.

## Extension points

### Templates and palettes

Add data-driven entries to `src/lib/campaign-presets.ts`. A template can define copy rhythm, layout, connected artwork, or device placement; transformations that replace a user's placement must be opt-in and tested.

### Devices

Add device dimensions and export targets in `src/lib/constants.ts`, then add presentation anatomy in `src/lib/device-models.ts` and frame rendering in `src/components/editor/device-frames.tsx`. Keep the screenshot transform independent from the hardware presentation transform.

### Imports

Keep external parsing and network access in `src/lib/app-store-import.ts` and `src/lib/app-store-server.ts`. Validate hostnames, bound downloads, avoid committing fetched assets, and turn imported composites into reference evidence rather than silently nesting them as captures.

### Agent automation

Use `pnpm storecanvas catalog --json` to discover supported IDs, then `inspect`, `apply-template`, `generate-background`, `validate`, and `render` as needed. `--json` is the stable machine-readable interface; `--dry-run` avoids both project writes and image-provider calls. The CLI uses the local Next.js `/api/agent` bridge so template and palette behavior cannot drift from the editor. A future MCP adapter should call this contract rather than reimplementing project transformations.

### Tests

Prefer small unit tests for pure transformation/schema functions and Playwright tests for user-visible workflows. Use only the checked-in demo assets or synthetic data in tests; private campaigns should never be a fixture.
