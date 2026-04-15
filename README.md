# Smart Crowd Navigator

A Gemini-powered web assistant for large sporting venues that helps attendees decide **where to go, whether to move now or wait, and how to avoid the worst crowd pressure**.

![Verification](https://img.shields.io/badge/verify-local%20gate-brightgreen)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Node-blue)
![Deployment](https://img.shields.io/badge/deploy-Cloud%20Run-4285F4)

## Challenge alignment

**Challenge vertical:** Physical Event Experience

This submission is built for the Prompt Wars brief in `problem.md` and directly targets the three challenge outcomes called out in that brief:
- **crowd movement**
- **waiting times**
- **real-time coordination**

## Chosen attendee persona

**Group coordinator at a large sporting venue**

This is the person in a family or friend group who makes movement decisions like:
- which gate to enter from
- where the group should go for food
- which washroom is least painful right now
- which exit will be smoother after the event
- whether the group should move now or wait a few minutes

## One-line pitch

Smart Crowd Navigator is a live venue assistant that turns queue pressure, route friction, and event timing into one practical answer: **go here now** or **wait, then go there instead**.

## Why this submission is strong

Most venue experiences stop at static maps or lists of options.

This product goes one level higher:
- it makes a recommendation, not just a lookup
- it explains **why** that option is best
- it can recommend **waiting** when moving immediately would be worse
- it updates when live venue conditions change

That makes it more useful in the exact moments that matter most in crowded events.

## What is shipped in this repository today

### Attendee experience
- mobile-first React web app
- attendee context controls for section, party size, event phase, and mobility mode
- free-text chat input plus quick actions in the same conversation flow
- one-tap decision flows for:
  - Food
  - Washroom
  - Entry Gate
  - Exit
- live recommendation card with:
  - primary option
  - go-now / wait guidance
  - ETA
  - queue time
  - route summary
  - crowd warning
  - fallback option
- group coordinator plan when the request benefits from runner / regroup guidance
- Google Maps citations for venue-perimeter answers when nearby-place grounding is used
- inline venue map panel highlighting the recommended destination

### Decision logic
- deterministic venue engine in TypeScript
- route ranking based on:
  - walking time
  - queue delay
  - crowd penalty
  - event-phase penalty
  - party-size service penalty
  - accessibility constraints
- explicit timing advice that can choose between:
  - `go_now`
  - `wait`

### Assistant layer
- Gemini-backed assistant response path using `@google/genai`
- deterministic fallback path when Gemini is disabled or unavailable
- validated structured request/response contracts using Zod

### Live update flow
- operator console for changing venue-state inputs
- live attendee recommendation refresh after operator changes
- Firebase-backed live venue state integration path in the repo
- local API fallback path for development and demo flows

### Group coordinator workflows
- runner pickup plans for larger food groups
- regroup-first guidance for mixed-mobility or step-free movement
- return-before-play guidance during break windows
- shared plan output in the same recommendation contract as the core route/timing answer

### Production-readiness work already in the repo
- Cloud Run deployment path
- security headers and request validation
- App Check verification support
- operator auth enforcement support
- Firestore rules for operator writes
- QA, security, deploy, and runbook documentation under `docs/`

## Current Google services usage

### Active in the current implementation
- **Gemini API** — assistant response generation with deterministic grounding from backend recommendation data
- **Google Maps grounding through Gemini** — venue-perimeter nearby-place guidance plus source citations in the UI
- **Cloud Run** — deployed runtime target for the Node API + web app
- **Firebase Auth** — operator sign-in path
- **Firestore** — live venue state persistence path
- **Firestore Security Rules** — operator/admin-only write protection
- **Firebase App Check** — client + backend verification path support

### Clearly not shipped yet in the current product
These are roadmap items, not current shipped capabilities:
- Firebase Hosting rollout
- production venue telemetry ingestion beyond the current repository fixtures/operator flows

## How the system works

### 1. Venue-state input
The app starts from venue state such as:
- attendee section
- destination queue minutes
- crowd pressure
- queue trend
- event phase
- mobility mode

### 2. Deterministic venue engine
The venue engine is the source of truth for movement decisions.

It ranks candidate destinations for a given intent and computes whether waiting improves the total outcome.

### 3. Gemini explanation layer
Gemini does **not** invent routes or wait times.

Instead, the backend computes the recommendation first, then Gemini turns that grounded result into a clearer attendee-facing response. If Gemini fails, the app falls back to a deterministic response path.

This keeps the system both **smart** and **testable**.

## Why this is practical for real events

- works as a web app on mobile devices
- helps users under time pressure make one decision quickly
- adapts to changing venue conditions
- gives operators a way to influence attendee guidance in real time
- keeps routing logic deterministic so it can be tested and trusted

## Accessibility posture

The shipped UI is designed around:
- keyboard-accessible controls
- large tap targets
- visible labels
- screen-reader-friendly status updates and recommendation sections
- accessible-route handling in the venue engine

## Security posture

The current repository keeps security in scope:
- Gemini API key stays server-side
- input payloads are validated
- protected routes can require App Check
- operator mutations can require authenticated operator access
- Firestore writes are protected by rules

See also:
- [docs/security-review.md](./docs/security-review.md)
- [docs/operations-runbook.md](./docs/operations-runbook.md)
- [docs/production-secrets.md](./docs/production-secrets.md)

## Testing and verification

The repository includes:
- engine unit tests
- API integration tests
- web rendering tests
- Playwright end-to-end tests for:
  - attendee chat follow-ups
  - Maps-grounded citation rendering
  - group coordinator plan rendering
  - operator/live-update flows
  - combined attendee regression lanes

Run the local quality gate with:

```bash
pnpm verify
```

Run the end-to-end suite directly with:

```bash
pnpm test:e2e
```

Run the real Gemini smoke lane with:

```bash
pnpm test:gemini-real
```

## Quick start

```bash
pnpm install
pnpm setup:local
pnpm dev
```

Then open:
- web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8080`

Live Cloud Run URL:
- `https://smart-crowd-navigator-6onqsv3h4a-uc.a.run.app`

## Submission readiness

Current repo state for submission:
- challenge-aligned README
- deployed Cloud Run URL
- deterministic routing core with live-state updates
- multi-turn attendee chat
- Google Maps-grounded perimeter answers with citations
- group coordinator workflows
- local verification gate and regression coverage

## Repository structure

- `apps/web` — attendee UI and operator experience
- `services/assistant-api` — API routes, Gemini boundary, request validation, static serving
- `packages/shared` — shared contracts and constants
- `packages/venue-engine` — deterministic route ranking and timing logic
- `tests/e2e` — Playwright coverage
- `docs/` — deploy, QA, security, and operations docs
- `problem.md` — challenge brief source material

## Supporting docs

- [docs/cloud-run-deploy.md](./docs/cloud-run-deploy.md)
- [docs/firebase-handoff.md](./docs/firebase-handoff.md)
- [docs/qa-report.md](./docs/qa-report.md)
- [docs/security-review.md](./docs/security-review.md)
- [docs/privacy-policy.md](./docs/privacy-policy.md)
- [docs/terms-of-use.md](./docs/terms-of-use.md)
- [docs/support-and-security.md](./docs/support-and-security.md)

## References

- Gemini text generation: https://ai.google.dev/gemini-api/docs/text-generation
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini Maps grounding: https://ai.google.dev/gemini-api/docs/maps-grounding
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase App Check: https://firebase.google.com/docs/app-check/web/recaptcha-provider
- Cloud Run auth: https://cloud.google.com/run/docs/authenticating/service-to-service
