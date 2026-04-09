# PRD: Smart Crowd Navigator

## Status
Accepted

## Problem
Attendees at large-scale sporting venues waste time and create extra congestion because they do not know the best gate, food stall, washroom, or exit for the current moment. Static venue apps are insufficient because they do not make real-time decisions based on changing crowd conditions.

## Goal
Build a web-based assistant that tells stadium attendees:
- where to go,
- whether to go now or wait,
- why this choice is best,
- how long it will take,
- and what fallback option exists.

## Persona
Primary persona: group coordinator attendee
- attends with friends/family
- makes movement decisions for the group
- values speed, clarity, and low-friction actions

## Non-Goals
- Full AR navigation
- Multi-venue generic platform in v1
- Deep Firebase production setup before requirements are available
- LLM-generated routing logic without deterministic guardrails

## Product Thesis
A single Gemini-powered chatbot plus deterministic routing/ranking engine will outperform a static map by making live movement decisions that reduce waiting time and crowd pressure.

## Core User Stories

### US-001: Food recommendation
As a stadium attendee, I want to tap Food and get the best available stall so that I spend less time walking and waiting.

Acceptance Criteria:
- User can select Food in one tap.
- System returns best stall, ETA, wait time, route summary, and fallback.
- Output is structured and renderable in the UI.

### US-002: Timing advice
As a stadium attendee, I want the assistant to tell me whether to go now or wait so that I avoid peak queues.

Acceptance Criteria:
- System can return `go_now` or `wait`.
- Wait recommendation includes suggested delay and estimated time saved.
- Logic is deterministic and unit-tested.

### US-003: Entry guidance
As an attendee entering the venue, I want the best gate recommendation so that I avoid crowded entry points.

Acceptance Criteria:
- User can select Entry Gate.
- System ranks gates based on crowd/route context.
- Recommendation includes one fallback gate.

### US-004: Exit guidance
As an attendee leaving the venue, I want the best exit option so that I can leave with less congestion.

Acceptance Criteria:
- User can select Exit.
- System ranks exits and returns route/crowd guidance.

### US-005: Washroom guidance
As an attendee, I want a low-friction washroom recommendation so that I can act quickly during the event.

Acceptance Criteria:
- User can select Washroom.
- System prioritizes speed and low queue time.

### US-006: Live adaptation
As an attendee, I want the recommendation to update when venue conditions change so that the app remains useful in real time.

Acceptance Criteria:
- Operator state changes update recommendations in an active session.
- Demonstrable in a live demo.

## Functional Requirements
- Single chatbot-first UI with quick action chips.
- Deterministic venue engine for ranking/routing/timing.
- Gemini tool-calling backend using `@google/genai`.
- Structured JSON assistant responses.
- Operator console for simulated live updates.
- Mobile-first PWA experience.

## Technical Decisions
- Frontend: React + TypeScript + Vite + Tailwind
- Backend: Node + TypeScript on Cloud Run
- AI: `gemini-3.1-flash-lite-preview` via `@google/genai`
- Data now: local/static seed fixtures first
- Data later: Firestore/Auth/App Check/Firebase Hosting after user provides details
- Testing: Vitest + Playwright
- Monorepo: pnpm workspace

## Success Criteria
- User can complete each core intent with a clear recommendation.
- Timing intelligence is visible and persuasive in demo.
- Docs align with competition rubric.
- Code remains modular and testable.

## Risks
- Preview model behavior/rate limits may vary.
- Indoor routing realism depends on venue graph quality.
- Firebase work is intentionally deferred.

## Delivery Strategy
1. Planning docs
2. Private repo + issue system
3. Repo scaffold
4. Venue engine + tests
5. Backend tool-calling API + tests
6. Chat-first UI + tests
7. Operator console + integration verification
8. Firebase phase later
