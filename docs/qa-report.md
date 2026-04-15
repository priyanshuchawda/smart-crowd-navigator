# QA Evidence Report

_Last updated: 2026-04-14 (post rubric hardening pass)_

## Current status

The repository is in a review-ready state with the roadmap implementation lanes merged through:
- README/challenge alignment
- production venue data contract
- multi-turn attendee chat
- stateful Gemini chat architecture
- Google Maps grounding + citation UI
- inline map preview + offline attendee shell
- official Maps Embed API path when `VITE_GOOGLE_MAPS_API_KEY` is configured
- Places API enrichment path for ratings, reviews, and open-now status when grounding returns a place id
- Cloud observability events for recommendation latency, fallback rate, and advisory frequency
- richer venue engine + telemetry
- group coordinator workflows
- explicit live-state sync boundary
- expanded regression coverage

## Latest verification evidence

### Repository + deployment evidence
- branch verification source: clean issue worktrees branched from `origin/main`
- deployed Cloud Run service verified via `gcloud` in project `priyanshu-portfolio-458519`
- current deployed URL:
  - `https://smart-crowd-navigator-6onqsv3h4a-uc.a.run.app`

### Local command evidence
- `pnpm verify` → pass
- `pnpm coverage` → available for package-level Vitest coverage reporting
- targeted Playwright regression suite → pass
  - `tests/e2e/accessibility-axe.spec.ts`
  - `tests/e2e/accessibility-smoke.spec.ts`
  - `tests/e2e/attendee-chat-followup.spec.ts`
  - `tests/e2e/maps-grounding-panel.spec.ts`
  - `tests/e2e/group-coordinator-plan.spec.ts`
  - `tests/e2e/attendee-regression-lanes.spec.ts`
- focused operator refresh smoke:
  - `pnpm build && pnpm exec playwright test tests/e2e/operator-refresh.spec.ts` → pass
- TypeScript project diagnostics:
  - `npx tsc --noEmit --pretty false --project ./tsconfig.json` → 0 errors / 0 warnings

### Build evidence
Latest verified web build output:
- `dist/assets/index-DT7bqk_e.js` → `266.13 kB` / `80.48 kB gzip`
- `dist/assets/firebase-4X6P2Yu-.js` → `495.99 kB` / `114.62 kB gzip`
- `dist/assets/OperatorExperience-VQovBBAF.js` → `6.24 kB` / `1.98 kB gzip`

Interpretation:
- attendee-critical UI remains in the main web bundle
- operator/Firebase-heavy logic stays code-split
- the operator bundle remains small
- Firebase remains the largest deferred client bundle and only loads when needed

## Accessibility evidence

Manual and code-level checks covered:
- skip link present at the top of the page
- keyboard focus styling present globally
- conversation flow uses explicit labels, button semantics, and a live transcript region
- recommendation sections use clear headings and alert/status regions
- reduced-motion mode is supported in CSS
- higher-contrast mode is now explicitly supported in CSS for stronger borders and less visual haze
- automated axe-core coverage now runs against the attendee shell in Playwright
- automated attendee-shell accessibility smoke now verifies:
  - skip link focus order
  - labeled attendee controls
  - transcript region visibility
  - recommendation status announcements
- manual keyboard pass covered:
  - skip link focus
  - quick action activation
  - chat composer focus and submit path
  - operator disclosure open/focus path

Areas specifically exercised by shipped flows:
- quick action entry
- free-text follow-up question entry
- recommendation card updates
- group coordinator plan visibility
- Maps citation visibility

## Performance posture

Current performance posture is acceptable for a review/demo submission because:
- operator-heavy code remains deferred
- Firebase code remains deferred
- attendee flow is immediately usable without opening demo controls
- the attendee shell is now cached by a lightweight service worker for low-connectivity concourses
- the service worker now precaches the active hashed web bundles discovered from the built shell
- Maps widget loading is optional and only attempted when the response includes a widget token and a browser Maps API key is configured

## Remaining non-code rollout work

Still required before a true public launch:
- production Firestore/App Check rollout in Firebase console
- final legal/support contact customization
- domain / hosting rollout choices
- production monitoring + alert routing beyond repo-level docs
- deployed browser smoke with a real `VITE_GOOGLE_MAPS_API_KEY` for the contextual Places widget

## Submission-confidence summary

The project now demonstrates:
- strong challenge alignment
- deterministic logic under live-changing state
- meaningful Google-service usage
- explicit source attribution for Maps-grounded answers
- group-native workflows beyond single-destination guidance
- a real deployed Cloud Run service
- strong local verification evidence
