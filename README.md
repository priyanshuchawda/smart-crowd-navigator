# Smart Crowd Navigator

Smart Crowd Navigator is a production-style web application for large sporting venues. It helps attendees decide where to go, whether to move now or wait, and how to avoid unnecessary crowd pressure using a deterministic venue engine, a Gemini-powered assistant layer, live venue-state updates, and Maps-grounded nearby-place guidance when a question extends beyond the venue perimeter.

![Verification](https://img.shields.io/badge/verify-local%20gate-brightgreen)
![Stack](https://img.shields.io/badge/stack-React%20%2B%20TypeScript%20%2B%20Node-blue)
![Deployment](https://img.shields.io/badge/deploy-Cloud%20Run-4285F4)

## Live deployment

- **Cloud Run URL:** `https://smart-crowd-navigator-6onqsv3h4a-uc.a.run.app`
- **Runtime model:** one deployed URL serving both the web app and the API

## What the product does

The application is designed for the **Physical Event Experience** problem space and focuses on three practical outcomes:
- improving crowd movement
- reducing waiting times
- supporting real-time coordination

The primary user is a **group coordinator** at a venue — the person making movement decisions for a family or friend group.

Typical questions the product answers:
- Which food stall should our group use right now?
- Should we go now or wait a few minutes?
- Which exit is currently smoother?
- What is the best regroup plan for a larger group?
- Where is the best nearby pickup point outside the venue perimeter?

## Core product capabilities

### Attendee experience
- mobile-first React web app
- free-text assistant chat plus quick-action entry points
- attendee context controls for section, party size, event phase, group coordination mode, and mobility mode
- installable web manifest plus cached offline shell for weak-connectivity venue areas
- live recommendation card with:
  - primary option
  - go-now / wait guidance
  - ETA
  - queue time
  - route summary
  - crowd warning
  - fallback option
  - group coordinator plan when relevant
- venue map panel with recommended destination highlighting
- Google Maps citations plus an inline map preview for venue-perimeter answers
- official Google Maps Embed API preview when `VITE_GOOGLE_MAPS_API_KEY` is configured, with a no-key fallback for demo resilience

### Decision engine
- deterministic venue engine in TypeScript
- venue graph with sections, concourses, ramps, stairs, elevator paths, gates, exits, food, and washrooms
- scoring based on:
  - walking time
  - queue delay
  - crowd pressure
  - event-phase penalty
  - telemetry confidence / variability
  - party-size service penalty
  - accessibility and mixed-mobility routing constraints
- explicit wait-vs-go timing advice
- group workflow support such as:
  - runner pickup
  - meet-up routing
  - return-before-play guidance

### Live state and operations
- operator console for live venue-state changes
- explicit live-state store boundary in the API
- Firebase-backed live venue-state sync path
- local fixture-backed fallback path for deterministic development and test runs

### Assistant layer
- Gemini-backed assistant responses via `@google/genai`
- stateful multi-turn chat architecture
- bounded model fallback chain:
  - `gemini-3.1-flash-lite-preview`
  - `gemini-3-flash-preview`
  - `gemini-2.5-flash`
- deterministic fallback mode when Gemini is disabled or unavailable
- Google Maps grounding for venue-perimeter questions

## Google services in use

- **Gemini API** — grounded assistant responses
- **Google Maps grounding through Gemini** — nearby-place and perimeter guidance
- **Cloud Run** — deployed runtime for the web app and API
- **Firebase Auth** — operator sign-in path
- **Firestore** — live venue-state persistence path
- **Firestore Security Rules** — protected write access for live state
- **Firebase App Check** — protected client/backend request verification path

## System architecture

### Frontend
- React
- TypeScript
- Vite
- mobile-first UI

### Backend
- Node.js
- TypeScript
- Cloud Run-friendly API boundary
- Gemini orchestration and deterministic routing integration

### Shared/domain packages
- `packages/shared` — request/response contracts and constants
- `packages/venue-engine` — venue topology, routing, ranking, timing advice, and group plan logic

## How the recommendation flow works

1. The attendee provides context such as section, party size, mobility mode, and event phase.
2. The backend computes the recommendation with the deterministic venue engine.
3. Gemini turns the grounded result into a more natural assistant response.
4. If the question is venue-perimeter related, Google Maps grounding is used to add nearby-place context and citations.
5. If live venue state changes, recommendations update accordingly.

## Security and reliability

The current implementation includes:
- server-side Gemini key handling
- input validation on request payloads
- App Check support
- operator auth support
- Firestore rules for protected writes
- rate limiting and structured API safeguards
- deterministic fallback behavior when AI/model calls are unavailable

Relevant docs:
- [docs/security-review.md](./docs/security-review.md)
- [docs/operations-runbook.md](./docs/operations-runbook.md)
- [docs/production-secrets.md](./docs/production-secrets.md)

## Accessibility

The shipped UI is designed around:
- keyboard-accessible interaction
- visible focus treatment
- skip-link support
- screen-reader-friendly status and recommendation regions
- reduced-motion support
- higher-contrast and forced-colors hardening
- semantic conversation transcript + grounded-place regions
- automated `axe-core` Playwright coverage for the attendee shell
- accessible-route support in the venue engine

## Testing and verification

The repository includes:
- engine unit tests
- API integration tests
- web rendering tests
- Playwright accessibility smoke coverage for the attendee shell
- Playwright `axe-core` accessibility audit coverage
- Playwright end-to-end coverage for:
  - attendee chat follow-ups
  - accessibility smoke checks
  - maps-grounded citation rendering
  - group coordinator plan rendering
  - live operator update flows
  - combined attendee regression lanes

Primary local verification command:

```bash
pnpm verify
```

Other useful commands:

```bash
pnpm test:e2e
pnpm test:gemini-real
pnpm coverage
```

## Local development

```bash
pnpm install
pnpm setup:local
pnpm dev
```

Then open:
- web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8080`

## Repository structure

- `apps/web` — attendee UI and operator experience
- `services/assistant-api` — API routes, Gemini boundary, request validation, static serving
- `packages/shared` — shared contracts and constants
- `packages/venue-engine` — deterministic route ranking, timing advice, and group workflow logic
- `tests/e2e` — end-to-end regression coverage
- `docs/` — deployment, QA, security, operations, privacy, and support docs
- `problem.md` — original challenge/problem reference

## Documentation

- [docs/cloud-run-deploy.md](./docs/cloud-run-deploy.md)
- [docs/firebase-handoff.md](./docs/firebase-handoff.md)
- [docs/qa-report.md](./docs/qa-report.md)
- [docs/security-review.md](./docs/security-review.md)
- [docs/privacy-policy.md](./docs/privacy-policy.md)
- [docs/terms-of-use.md](./docs/terms-of-use.md)
- [docs/support-and-security.md](./docs/support-and-security.md)
- [docs/venue-data-contract.md](./docs/venue-data-contract.md)
- [docs/gemini-conversation-architecture.md](./docs/gemini-conversation-architecture.md)
- [docs/gemini-model-fallbacks.md](./docs/gemini-model-fallbacks.md)
- [docs/maps-grounding-guidance.md](./docs/maps-grounding-guidance.md)

## References

- Gemini text generation: https://ai.google.dev/gemini-api/docs/text-generation
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini Maps grounding: https://ai.google.dev/gemini-api/docs/maps-grounding
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase App Check: https://firebase.google.com/docs/app-check/web/recaptcha-provider
- Cloud Run auth: https://cloud.google.com/run/docs/authenticating/service-to-service
