# Contributing to StoreCanvas

Thanks for helping make StoreCanvas a sharper, more trustworthy way to build app-store campaigns. Contributions are welcome across the editor, renderer, accessibility, documentation, templates, palettes, and test coverage.

Please read the [Code of Conduct](CODE_OF_CONDUCT.md) before participating. For a security vulnerability, follow [SECURITY.md](SECURITY.md) instead of opening a public issue.

## Development setup

Requirements:

- Node.js `>=20.9.0`
- pnpm `11.9.0` (the repository pins this through `packageManager`)
- Chromium for Playwright UI tests

```bash
pnpm install
pnpm dev
```

The checked-in `example-project.json` and self-authored SVGs are safe fixtures. A local `app-store-screenshots.json` is intentionally ignored and may be auto-discovered for local work; never commit it or any private captures.

## Verification commands

Run the smallest relevant check while iterating, then the full gate before opening a pull request:

```bash
pnpm typecheck
pnpm test
pnpm exec playwright install chromium   # first UI run on a new machine
pnpm test:ui
pnpm build
pnpm audit --audit-level high
```

`pnpm test:all` runs the unit and UI suites together. CI runs the same checks on every push and pull request to `main`.

## Contribution guidelines

1. Start with an issue for substantial behavior changes and explain the user outcome.
2. Keep changes focused. Preserve the local-first boundary: browser storage and explicit local files are the source of truth; do not add a hosted database, account system, usage meter, checkout, or monetization flow.
3. Add a unit test for schema, migration, import, rendering, or state logic. Add a Playwright test for a user-visible editor workflow or an export regression.
4. Keep templates and palettes data-driven in `src/lib/campaign-presets.ts`. If a template intentionally changes placement or connected artwork, make the override opt-in and cover it with a regression test.
5. Keep external provider keys transient. Never place keys in fixtures, screenshots, logs, project JSON, or pull requests.
6. Use only assets you have the right to redistribute. Prefer small, self-authored SVG fixtures for tests and demos.
7. Update user-facing documentation, `CHANGELOG.md`, and attribution when the change affects behavior or dependencies.

## Pull requests

Use a descriptive branch and commit message, explain the before/after behavior, and include the verification commands you ran. Reviewers should be able to clone the repository, run the documented commands, and reproduce the result without private files or services.

The [architecture guide](docs/architecture.md) explains the main data boundaries and extension points. The [roadmap](ROADMAP.md) records ideas that are intentionally not promises.
