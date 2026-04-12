# QA Evidence Report

_Last updated: 2026-04-11 (post production-readiness hardening)_

## Current Status

Core product code is implemented and locally verified.

## Implemented Areas

- monorepo scaffold
- shared contracts and schemas
- deterministic venue engine
- timing advice and fallback logic
- recommendation API
- Gemini tool-calling boundary
- prompt/response hardening
- attendee chat shell
- operator console and operator auth flow
- live recommendation refresh
- Firestore-backed operator state sync
- Firestore security rules
- App Check web + backend support
- production env validation for secrets/runtime config
- code-split operator/Firebase web loading path
- local verification workflow
- deterministic Playwright E2E coverage

## Latest Verification Evidence

### Repository state
- branch: `main`
- no open GitHub issues remain after the current hardening pass

### Command evidence
- `pnpm verify` → pass
- `pnpm test:e2e` → pass
- `pnpm test:gemini-real` → previously documented pass
- `pnpm setup:local` → local-dev helper path remains available

### Current build evidence
- initial attendee web chunk reduced to ~244 kB gzip-uncompressed artifact size class
- Firebase/operator logic is split into separate web chunks
- no Vite large-chunk warning remains in the latest verified build output

## Remaining non-code rollout work

Still required before real public launch:
- Firebase console-side App Check enforcement
- hosting/domain rollout
- production monitoring and alerting wiring
- privacy/terms/support policy customization
- deployed smoke tests against real cloud infrastructure
