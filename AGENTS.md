# AGENTS.md

## Project

slack-file-preview-cloudflare is a Cloudflare Workers + Workflows Slack app that detects Markdown and HTML files shared in Slack, generates safe previews, and posts preview links back to the Slack thread.

## Setup

```sh
npm install
```

Required toolchain versions:

- Node.js >=22.12.0
- npm with `package-lock.json`

## Common Commands

| Task | Command |
|---|---|
| Dev server | `npm run dev` |
| Test | `npm test` |
| Lint | not configured |
| Typecheck | `npm run check` |
| Deploy | `npm run deploy` |
| TDD/BDD profile check | `npm run tdd:check` |

## Code Style

- TypeScript is strict and targets Cloudflare Workers.
- Keep Slack request body handling raw until signature verification is complete.
- Keep file rendering fail-closed for unsafe input, especially HTML.
- Prefer small, behavior-backed changes over speculative abstractions.

## Testing Conventions

- Test framework: Vitest.
- Test location: `tests/**/*.test.ts`.
- New behavior starts from a failing unit test or an acceptance scenario in `docs/testing/BDD_SCENARIOS.md`.
- Bug fixes require a reproducing test before implementation.

## Security Notes

- Secrets are never committed. Use `.dev.vars` locally and Cloudflare secrets remotely.
- Do not expose Slack `url_private_download` or bot tokens to browsers or Slack messages.
- Do not serve raw HTML previews in the MVP path; render text-safe HTML only.
- R2 buckets stay private; preview access goes through signed Worker URLs.

## Where Agents Should Look

- Source: `src/`
- Tests: `tests/`
- Testing policy: `docs/testing/`
- Architecture: `docs/ARCHITECTURE.md`
- Usage: `docs/USAGE.md`
- API surface: `docs/API.md`
- Security notes: `docs/SECURITY.md`
