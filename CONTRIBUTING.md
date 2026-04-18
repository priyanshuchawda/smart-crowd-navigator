# Contributing to Smart Crowd Navigator

Thanks for contributing.

## Prerequisites

- Node.js 22.x
- pnpm 9.x
- Git

## Local setup

```bash
pnpm install
pnpm setup:local
pnpm dev
```

Local endpoints:

- web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8080`

## Verification expectations

Run this before opening a PR:

```bash
pnpm verify
```

If your change affects browser flows, also run:

```bash
pnpm test:e2e
```

If your change touches Gemini integration behavior, also run:

```bash
pnpm test:gemini-real
```

## Branch and PR conventions

- Keep each PR scoped to one issue or one focused change.
- Reference the issue in PR description (for example, `Closes #123`).
- Prefer descriptive branch names such as:
  - `feat/issue-123-short-name`
  - `fix/issue-123-short-name`
  - `docs/issue-123-short-name`

## What maintainers expect in PRs

- Include a short summary of what changed and why.
- Include validation evidence (commands you ran and outcomes).
- Update tests when behavior changes.
- Update docs for any user-facing or operational changes.
- Avoid bundling unrelated refactors in the same PR.

## Repository layout quick reference

- `apps/web` — attendee and operator UI
- `services/assistant-api` — API routes, model orchestration, auth checks
- `packages/shared` — shared contracts/constants
- `packages/venue-engine` — deterministic routing and ranking logic
- `tests/e2e` — Playwright end-to-end tests
- `docs` — deployment, operations, security, and policy docs

## Security reporting

Do not post secrets or exploit details publicly.

Follow the security handoff guidance in `docs/support-and-security.md`.
