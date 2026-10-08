# Changelog

All notable changes to StoreCanvas are documented here. This project follows a lightweight [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) format; releases will be tagged when a stable versioning policy is established.

## [Unreleased]

### Added

- Open-source community health files, contribution guidance, issue forms, CI, Dependabot, security policy, support policy, roadmap, architecture notes, and citation metadata.
- A repository audit record with reproducible quality and dependency checks.
- A JSON-first agent bridge and CLI for catalog discovery, template/palette composition, 1–10-slot AI backgrounds, validation, and deterministic rendering, plus a reusable `storecanvas-agent` skill.
- iPhone and iPad landscape: sideways device frames and every App Store display class rotated (6.9", 6.5", 6.3", 6.1", 13", 12.9"), with size selections carried across orientation flips and the split layout available on landscape Apple decks.
- Agent CLI commands to read and edit a campaign without touching JSON: `screens`, `edit-screen` (copy, layout, screenshots) and `set-project` (device, orientation, locale, palette), plus per-command help, a `help --json` manifest, JSON errors with hints and typo suggestions.
- Editor: a keyboard shortcuts sheet (`?`), left/right screen paging and `⌘/Ctrl+E` export; QA issues name their device and screen and jump to it; optional artwork and extra-device panels fold under "Extras" until a screen uses them.

### Changed

- Updated Next.js, React, Sharp, Vitest, Playwright, Vite, jsdom, and related test tooling to supported patched versions, with Node.js `>=22.13.0` matching pnpm 11's runtime requirement.
- Made pnpm the single documented package-manager path and pinned the supported Node.js and pnpm versions.
- Declared local development origins for the Next.js dev server so browser tests remain reproducible.
