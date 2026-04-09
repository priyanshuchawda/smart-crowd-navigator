# Phased Roadmap: Smart Crowd Navigator

## Phase 0 — Planning and Delivery Setup
Goal: lock scope, docs, repo, and issue process
Outputs:
- PRD
- test spec
- roadmap
- private GitHub repo
- labels and milestone/issues

## Phase 1 — Monorepo Scaffold
Goal: create the baseline project structure and automation
Outputs:
- pnpm workspace
- apps/web
- services/assistant-api
- packages/shared
- packages/venue-engine
- lint/typecheck/test/build scripts
- CI baseline

## Phase 2 — Venue Engine MVP
Goal: implement deterministic ranking/routing/timing with fixtures
Outputs:
- seed venue graph
- option ranking
- fallback logic
- go-now/wait logic
- unit tests

## Phase 3 — Assistant API MVP
Goal: expose backend endpoints and Gemini orchestration around the venue engine
Outputs:
- typed API contract
- tool declarations
- structured output handling
- integration tests

## Phase 4 — Chat-First Attendee UI
Goal: make the assistant usable and judge-friendly
Outputs:
- mobile-first chat layout
- quick action chips
- recommendation cards
- Playwright baseline tests

## Phase 5 — Operator Console + Live Updates
Goal: demonstrate real-time recommendation changes
Outputs:
- operator controls for queue/crowd changes
- live refresh/update path
- end-to-end demo verification

## Phase 6 — Firebase Integration (Deferred)
Goal: replace local fixtures/realtime mocks with Firebase services when details are available
Outputs:
- Firestore
- Firebase Auth
- App Check
- Hosting deployment

## Phase 7 — Submission Polish
Goal: maximize competition readiness
Outputs:
- final README
- demo script
- screenshots/video assets
- final verification run
