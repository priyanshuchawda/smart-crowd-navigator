# Smart Crowd Navigator

A Gemini-powered stadium assistant that tells attendees where to go, whether to go now or wait, and which route will be fastest with the least congestion.

## Quick Start

```bash
pnpm install
pnpm setup:local
pnpm dev
```

If `key.md` contains a Gemini API key, `pnpm setup:local` will create `.env` and populate `GEMINI_API_KEY` automatically for local testing only. Production should inject secrets through environment variables or Secret Manager-backed deploy configuration.

Then open:
- web: `http://127.0.0.1:5173`
- API: `http://127.0.0.1:8080`

For a single-command local quality gate:

```bash
pnpm verify
```

## Chosen Vertical

**Physical Event Experience**

This solution is designed for attendees at large-scale sporting venues and focuses on three core problems from the challenge:
- crowd movement
- waiting times
- real-time coordination

## Chosen Persona

**Group coordinator attendee**

This is the person in a family or friend group who usually makes decisions like:
- which gate to use
- where to get food
- which washroom is quickest
- which exit is least chaotic
- when the group should move now vs wait a few minutes

> Note: `problem.md` mentions an official vertical/persona list, but that list is not included in this repository. This README assumes the “group coordinator attendee” persona unless the official challenge materials require a different label.

## One-Line Pitch

Smart Crowd Navigator is a live web assistant for stadium attendees that finds the best option right now — and can also tell you when **not** to move yet because waiting a few minutes will save time and reduce congestion.

## Why This Idea Can Win

Most venue apps are passive:
- they show maps
- they list stalls
- they leave the decision to the user

This app is different:
- it acts like a smart assistant
- it makes a context-aware recommendation
- it explains *why*
- it adapts when venue conditions change

The key differentiator is that it answers two questions:
1. **Where should I go?**
2. **Should I go now or wait?**

Example:

> “Don’t go for food right now. Queue pressure near your section is peaking. Wait 7 minutes and use Stall B instead — total time saved: 9 minutes.”

That makes the experience feel dynamic, useful, and realistic.

## What the User Does

1. Opens the web app
2. Selects or confirms their section
3. Taps one of four intents:
   - Food
   - Washroom
   - Entry Gate
   - Exit
4. Gets a live recommendation with:
   - best option
   - go now / wait guidance
   - ETA
   - queue time
   - route summary
   - crowd warning
   - fallback option

## How the Solution Works

The system combines a deterministic venue engine with a Gemini chatbot.

### 1) Venue state
Live venue data is stored for:
- sections
- food stalls
- washrooms
- entry gates
- exits
- queue estimates
- blocked paths
- crowd hotspots
- event phase

### 2) Decision engine
A deterministic TypeScript engine calculates the best option using:
- walking time
- queue length
- crowd level
- short-term queue trend
- event timing
- accessibility constraints

This is the source of truth for route and ranking decisions.

### 3) Gemini assistant
Gemini does **not** invent routes or wait times.

Instead, Gemini:
- calls backend tools
- requests ranked options
- asks for route details
- asks for timing advice
- converts the results into a clear, conversational answer

This keeps the system both smart **and** testable.

## Core Logic

The main recommendation logic is:

**best option = lowest overall cost**

That cost is based on:
- walking ETA
- queue delay
- congestion penalty
- event-phase penalty
- trend penalty
- accessibility penalty

The system can also recommend:
- **go now**
- **wait X minutes**

when waiting creates a better total outcome.

## Google Services Used

Currently implemented:

- **Gemini API**
  - chatbot orchestration
  - tool calling
  - structured response generation
  - explanation of live recommendations

Implemented with the current operator-hardening pass:

- **Firebase Auth**
  - operator sign-in for restricted console access

- **Firestore**
  - persistent live venue state
  - queue updates
  - operator-triggered changes guarded by Firestore rules
  - session data

- **Firestore Security Rules**
  - public attendee reads for live state
  - operator/admin-only writes through `operator-roles/{uid}`

- **Firebase App Check**
  - web initialization path for browser attestation
  - backend verification path for protected Node API routes

- **Firebase App Check enforcement**
  - still needs Firebase console enforcement toggled for Firestore and any other protected products

Still deferred:

- **Firebase Hosting**
  - web app deployment

Implemented platform/services today:

- **Local Node API**
  - Cloud Run-ready backend boundary for Gemini calls and tool execution

- **Firebase Web SDK**
  - web config module
  - Firestore-backed operator state path with local API fallback
  - analytics bootstrap when supported

- **Google Maps (planned integration path)**
  - perimeter guidance such as parking-to-gate context
  - nearby landmark awareness

## Architecture

### Frontend
- React
- TypeScript
- Vite
- Tailwind CSS
- mobile-first PWA experience

### Backend
- Node.js
- TypeScript
- local Node.js API service designed for Cloud Run deployment later
- Gemini tool orchestration using `@google/genai`

### Data Model
- venue metadata
- nodes for sections/stalls/washrooms/gates/exits
- edges for walkable paths
- queue collections
- live crowd state
- session records

## Current Implementation Status

Implemented now:
- deterministic venue engine
- timing advice and fallback logic
- typed recommendation API
- Gemini assistant boundary using `@google/genai`
- attendee chat shell
- operator console for local live-state updates
- Firebase web config and Firestore-backed operator state sync
- local verification workflow

Deferred for later:
- Firebase App Check console enforcement rollout
- Firebase Hosting production setup
- Google Maps perimeter integration

## Why We Did Not Use Google Maps for Indoor Routing

Google Maps is valuable for outer-perimeter guidance, but stadium concourses, stairs, ramps, and section-specific flows require a custom indoor graph.

So this solution uses:
- **custom indoor routing** for inside the venue
- **Google Maps** for outside-the-venue context

This keeps the MVP practical and believable.

## Smart Assistant Tool Design

The chatbot can use backend tools such as:
- `get_user_context`
- `get_ranked_options`
- `get_best_route`
- `get_fallback_option`
- `get_timing_advice`

This makes the chatbot an actual assistant instead of a plain text interface.

## Why It Is Practical

This solution is practical because:
- it works as a web app
- it does not require installing a native app
- it reduces decision time for attendees under pressure
- it can be demoed with simulated live queue updates
- it directly improves both user experience and crowd distribution

## Accessibility

The product is designed to support accessibility by default:
- mobile-first large tap targets
- keyboard-accessible interaction
- visible text labels, not color alone
- screen-reader-friendly recommendation cards
- accessible-route consideration in the decision engine

## Security

Security is part of the design:
- Gemini API keys stay server-side
- Cloud Run handles model access
- Firestore Rules protect writes
- App Check reduces abusive traffic
- user location/context retention should be minimized

## Testing Strategy

The project will include:
- **unit tests** for ranking and timing logic
- **integration tests** for the Gemini tool-calling loop
- **end-to-end tests** for one core attendee journey

Most important test:
- prove the assistant can correctly choose both:
  - **go now**
  - **wait**

under different live queue conditions.

## Demo Story

The strongest live demo is:

1. Start with a user in one section
2. Ask for food
3. Show:
   - best stall
   - ETA
   - queue time
   - route
   - fallback
   - go now / wait decision
4. Change live queue state from the operator console
5. Show the recommendation change instantly
6. Repeat once for exit or washroom

This makes the intelligence obvious within minutes.

## Local Demo Steps

1. Start the API and web app.
2. In the attendee shell, keep the default section as `section-a12`.
3. Tap **Food** to get the first recommendation.
4. Use the operator console to increase `stall-b` queue minutes and crowd penalty.
5. Watch the recommendation update toward `stall-d`.
6. Reset the operator state to restore the baseline recommendation.

## Assumptions Made

- The official persona list is not included in this repository, so the current persona is inferred from the problem statement.
- Queue, congestion, and path-closure data may be simulated for the competition demo.
- The system targets one venue configuration for the MVP.
- Indoor routing is venue-graph-based rather than full map-navigation parity.
- The single best experience is more valuable for judging than a broad multi-persona scope.

## Repository Structure

- `apps/web` — attendee UI and operator console
- `services/assistant-api` — API routes, Gemini boundary, recommendation builder
- `packages/shared` — shared constants and schemas
- `packages/venue-engine` — deterministic ranking, fallback, and timing logic
- `problem.md` — original challenge brief
- `plan.md` — execution plan and product strategy

## Development Workflow

This project currently uses **local verification first** instead of automatic GitHub Actions checks.

Before merging any issue branch, the expected gate is:
- lint
- typecheck
- tests
- build
- manual/live verification when needed

Recommended one-command local gate:

```bash
pnpm verify
```

Real Gemini integration verification:

```bash
pnpm test:gemini-real
```

Firebase handoff checklist:

- [docs/firebase-handoff.md](./docs/firebase-handoff.md)
- [firestore.rules](./firestore.rules)
- [docs/production-secrets.md](./docs/production-secrets.md)
- [docs/operations-runbook.md](./docs/operations-runbook.md)
- [docs/security-review.md](./docs/security-review.md)
- [docs/qa-report.md](./docs/qa-report.md)

Automatic GitHub Actions runs are disabled to avoid unnecessary hosted CI usage during development.

## References

- Gemini 3.1 Flash-Lite model: https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-preview
- Gemini function calling: https://ai.google.dev/gemini-api/docs/function-calling
- Gemini structured output: https://ai.google.dev/gemini-api/docs/structured-output
- Gemini tools overview: https://ai.google.dev/gemini-api/docs/tools
- Gemini Maps grounding: https://ai.google.dev/gemini-api/docs/maps-grounding
- Firestore realtime listeners: https://firebase.google.com/docs/firestore/query-data/listen
- Firestore security rules: https://firebase.google.com/docs/firestore/security/get-started
- Firebase App Check: https://firebase.google.com/docs/app-check/web/recaptcha-provider
- Cloud Run auth: https://cloud.google.com/run/docs/authenticating/service-to-service
- Google Maps routes: https://developers.google.com/maps/documentation/javascript/routes/routes-polylines
