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

## Maintainer actions outside the repository

Some trust signals are GitHub settings and cannot be encoded in a commit. Before announcing the project publicly:

1. Switch the repository visibility to public when ready.
2. Enable branch protection or repository rules for `main`, requiring the CI check before merge.
3. Enable GitHub Discussions if the community support links should be interactive.
4. Enable private vulnerability reporting and secret scanning/push protection where the account plan supports them.
5. Review the first Scorecard result after the repository becomes public; its checks are heuristics, not a substitute for maintainer judgment.

The repository intentionally does not ship personal campaign captures or a remote database. A local ignored campaign may still be auto-discovered in a developer checkout, while the public demo starts from the safe checked-in example.
