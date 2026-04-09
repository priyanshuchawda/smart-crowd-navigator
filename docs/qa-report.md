# QA Evidence Report

_Last updated: 2026-04-09 (post Firebase web integration)_

## Current Status

Smart Crowd Navigator is complete for the currently planned implementation.

Remaining deferred scope:
- Firebase Auth
- App Check
- Firebase Hosting deployment
- Google Maps perimeter integration

## Implemented Areas

- monorepo scaffold
- shared contracts and schemas
- deterministic venue engine
- timing advice and fallback logic
- recommendation API
- Gemini tool-calling boundary
- attendee chat shell
- operator console
- live recommendation refresh
- Firebase web config module
- Firestore-backed operator state sync with local API fallback
- local verification workflow
- deterministic Playwright E2E coverage
- local env bootstrap and demo runner

## Latest Verification Evidence

### Repository state
- branch: `main`
- working tree: clean
- no open implementation blockers remain in the repo issue list after the current QA refresh lands

### Command evidence
- `pnpm verify` → pass
- `pnpm test:e2e` → pass
- `pnpm setup:local` → pass
- `pnpm dev` → confirmed API and web startup
- Firebase-enabled local `.env` verified with the provided `winning-every` project values

### Live checks previously confirmed
- `GET /health` returns API status and engine version
- `POST /assistant-response` returns Gemini-backed assistant output when `.env` contains a valid Gemini key
- operator update changes recommendation output in the same attendee flow
- Firestore-backed operator state path is wired in the web app with local API fallback when Firebase sync is unavailable

## Known Deferred Scope

Still deferred:
- Firebase Auth
- App Check
- Firebase Hosting deployment wiring
- Google Maps perimeter integration
