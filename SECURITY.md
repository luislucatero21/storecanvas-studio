# Security policy

StoreCanvas is a local-first editor. The repository is designed to keep campaign state in the browser or in an explicitly configured local JSON file, and Vercel deployments are read-only at runtime. That boundary reduces the amount of data the project needs to handle, but it does not make a public deployment a private vault.

## Supported versions

| Version | Supported |
| --- | --- |
| `main` | Yes |
| Older commits and forks | Best effort |

## Reporting a vulnerability

Please report security vulnerabilities privately through [GitHub private vulnerability reporting](https://github.com/luislucatero21/storecanvas-studio/security/advisories/new). Do not open a public issue, attach private campaign files, or paste API keys into a discussion.

Include:

- the affected commit, version, route, or component;
- clear reproduction steps or a minimal proof of concept;
- the impact and any required permissions or runtime conditions;
- a suggested mitigation if you have one.

We aim to acknowledge a report within seven days and will coordinate disclosure and a fix with the reporter. If private reporting is unavailable for your account, contact the maintainer through [GitHub](https://github.com/luislucatero21) and ask for a secure channel.

## Security boundaries

- `app-store-screenshots.json`, `.env*.local`, uploads, generated backgrounds, exports, and test artifacts are ignored and must remain out of commits.
- AI keys are supplied by the user for the current dialog session, sent to the selected provider, and never written to StoreCanvas project storage.
- App Store imports accept the public Apple lookup flow and validate Apple image hosts before downloading assets.
- Vercel cannot provide durable local-file or asset storage; the deployed project keeps edits in the current browser origin.
- Imported App Store metadata, screenshots, app icons, and logos may have third-party terms. Users are responsible for permissions and redistribution rights.

## Keeping deployments safe

Use `.env.local` for local secrets, rotate a key immediately if it is exposed, review provider and network costs independently, and keep dependencies current with Dependabot and `pnpm audit --audit-level high`.
