# Open-source readiness audit

Audit snapshot: **2026-08-31**
Repository: [`luislucatero21/storecanvas-studio`](https://github.com/luislucatero21/storecanvas-studio)

This is a point-in-time maintainer checklist, not a security certification. It follows GitHub's guidance for [healthy contributions](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions), the [repository security policy guidance](https://docs.github.com/en/code-security/getting-started/quickstart-for-securing-your-repository), and the OpenSSF [Scorecard checks](https://github.com/ossf/scorecard/blob/main/docs/checks.md).

## Baseline review

| Area | Result | Evidence |
| --- | --- | --- |
| License and reuse | Complete | [`LICENSE`](../LICENSE), MIT metadata in `package.json`, and asset-rights notes in [`THIRD_PARTY.md`](../THIRD_PARTY.md) |
| Project entry point | Complete | README with live demo, quick start, capabilities, privacy boundary, renderer, tests, and links to every maintainer document |
| Contribution path | Complete | [`CONTRIBUTING.md`](../CONTRIBUTING.md), pull-request checklist, issue forms, and architecture guide |
| Community safety | Complete | [`CODE_OF_CONDUCT.md`](../CODE_OF_CONDUCT.md) and [`SUPPORT.md`](../SUPPORT.md) |
| Vulnerability disclosure | Complete | [`SECURITY.md`](../SECURITY.md) and private-reporting link |
| Automated verification | Complete | GitHub Actions CI runs audit, typecheck, unit tests, Playwright UI tests, and production build |
| Dependency hygiene | Complete at audit time | Dependabot configuration, pinned package manager, patched dependency tree, and `pnpm audit --audit-level high` |
| Reproducibility | Complete | `pnpm-lock.yaml`, Node/pnpm requirements, deterministic renderer, and local fixtures |
| Project discoverability | Complete | package keywords, repository metadata, Vercel demo, roadmap, changelog, and [`CITATION.cff`](../CITATION.cff) |
| Private-data hygiene | Complete | ignored local campaign/assets, neutral checked-in fixtures, and explicit contribution/security guidance |

## Verification commands

Run from the repository root:

```bash
pnpm install --frozen-lockfile
pnpm audit --audit-level high
pnpm typecheck
pnpm test
pnpm exec playwright install chromium
pnpm test:ui
pnpm build
```

The audit pass for this snapshot produced:

- `pnpm audit --audit-level high`: no known vulnerabilities;
- `pnpm typecheck`: passed;
- Vitest: 53 unit tests passed;
- Playwright: 32 UI tests passed;
- Next.js production build: passed.

## Security review: 2026-11-10

Scope: every route under `src/app/api/`, the `/render` page, the editor's rendering of project JSON, the agent CLI, response headers, and the dependency tree. Exploits were reproduced only against a local server; the live demo received a handful of header and route-existence requests.

| # | Finding | Severity | Status |
| --- | --- | --- | --- |
| 1 | Dependency advisories: Next.js 16.0.0–16.4.0 (two critical RCEs, one high DoS), Zod < 4.6.6 (memory exhaustion while validating request bodies), undici < 8.12.2, Vite 8.2.0–8.2.3 | Critical | Fixed: Next.js 16.4.5, Zod 4.6.7, Vite 8.3, undici override `^8.12.2` |
| 2 | Cross-site writes to a running local server: the POST routes parsed any body as JSON, so a page on another site could overwrite the configured project file or write into `public/screenshots/uploaded` with a `text/plain` request | Medium | Fixed: POST routes require `application/json` and a same-origin `Sec-Fetch-Site`/`Origin` when the browser sends one (`src/lib/request-guard.ts`) |
| 3 | App Store image downloads and the image proxy followed redirects without re-checking the host, buffered the whole body before the size check, and passed any `image/*` type (including SVG) through on the app's origin | Medium | Fixed: at most three redirects, each on `https://*.mzstatic.com`; png/jpeg/webp/gif only; streamed 15 MB cap; `nosniff` and a sandboxing CSP on proxied bytes |
| 4 | `storecanvas render` used the project's locale as a folder name, so a shared campaign could write PNGs outside `--output` | Medium | Fixed: locales must be language tags, devices must be known, destinations must stay under the output folder |
| 5 | No CSP, framing or MIME-sniffing headers on the demo | Low | Fixed: CSP (`connect-src 'self'`, `object-src 'none'`, `frame-ancestors 'none'`), `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy` |
| 6 | `next dev` and `next start` listen on every network interface, so other devices on the same network can read `GET /api/project` (including an auto-discovered private campaign) | Medium | Documented in `SECURITY.md`; bind to `127.0.0.1` when working on a shared network |
| 7 | A self-hosted public deployment that is not on Vercel and does not set `STORECANVAS_READ_ONLY=1` lets any visitor write uploads to disk and replace the in-memory project other visitors see | Medium | Documented in `SECURITY.md`; set `STORECANVAS_READ_ONLY=1` on any shared host |
| 8 | The AI and image routes relay to fixed provider endpoints with the visitor's own key; the demo spends function time on them and has no rate limit | Low | Accepted; rate-limit `/api/ai/*` with a Vercel Firewall rule if usage grows |

Confirmed safe:

- **No server-side AI key.** `/api/ai/improve`, `/api/ai/image` and the agent's `generate-background` read the key only from the request body and refuse without one. No route reads a provider key from the environment, and nothing logs request bodies.
- **No open proxy.** Provider endpoints are hard-coded (`api.openai.com`, `openrouter.ai`); the request body is rebuilt from validated fields. App Store lookups go only to `itunes.apple.com` with a numeric app id parsed from an `https://apps.apple.com` URL.
- **No filesystem reach from requests.** Project reads and writes use only the configured `STORECANVAS_PROJECT_FILE` or fixed names; uploads are content-addressed (`sha1.ext`) under `public/screenshots/uploaded`; imported assets go to `public/screenshots/imported/apple-<numeric id>`. On Vercel (`VERCEL=1`) none of these paths write.
- **No script execution from project data.** Text layers render as React text, fonts and colours go through React style objects, images load through `<img>` (SVG in `<img>` cannot run script), and there is no `dangerouslySetInnerHTML` in `src/`.

## Maintainer actions outside the repository

Some trust signals are GitHub settings and cannot be encoded in a commit. Before announcing the project publicly:

1. Switch the repository visibility to public when ready.
2. Enable branch protection or repository rules for `main`, requiring the CI check before merge.
3. Enable GitHub Discussions if the community support links should be interactive.
4. Enable private vulnerability reporting and secret scanning/push protection where the account plan supports them.
5. Review the first Scorecard result after the repository becomes public; its checks are heuristics, not a substitute for maintainer judgment.

The repository intentionally does not ship personal campaign captures or a remote database. A local ignored campaign may still be auto-discovered in a developer checkout, while the public demo starts from the safe checked-in example.
