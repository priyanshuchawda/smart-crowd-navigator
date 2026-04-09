# QA Evidence Report

_Last updated: 2026-04-09_

## Current Status

Smart Crowd Navigator is complete for all non-Firebase work.

Remaining blocker:
- GitHub issue #12 — Firebase integration is intentionally blocked pending project details from the user.

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
- local verification workflow
- deterministic Playwright E2E coverage
- local env bootstrap and demo runner

## Latest Verification Evidence

### Repository state
- branch: `main`
- working tree: clean
- only open issue: `#12 Track deferred Firebase integration requirements`

### Command evidence
- `pnpm verify` → pass
- `pnpm test:e2e` → pass
- `pnpm setup:local` → pass
- `pnpm dev` → confirmed API and web startup

### Live checks previously confirmed
- `GET /health` returns API status and engine version
- `POST /assistant-response` returns Gemini-backed assistant output when `.env` contains a valid Gemini key
- operator update changes recommendation output in the same attendee flow

## Known Deferred Scope

Still deferred until Firebase details arrive:
- Firebase Auth
- Firestore persistence
- App Check
- Firebase Hosting deployment wiring
- Google Maps perimeter integration

## Required Input To Continue

1. Firebase project ID
2. auth mode: anonymous / email / Google / no-auth-yet
3. Firestore Native mode yes/no
4. emulator or direct cloud wiring
5. Hosting target details if any
6. Firebase config values if available
