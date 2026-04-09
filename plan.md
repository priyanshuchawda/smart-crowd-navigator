# Smart Crowd Navigator Plan

## Goal
Build a web app where a single Gemini-powered chatbot helps stadium attendees find the best food stall, washroom, entry gate, or exit based on live queue data, crowd density, and route conditions.

## Chosen Persona / Vertical
- Primary persona: the group coordinator attending a large sporting event with friends or family.
- Why this persona:
  - it naturally creates coordination problems,
  - it makes food, washroom, and exit decisions matter more,
  - it gives us a clean story for real-time logic and accessibility.
- Important note:
  - `problem.md` mentions an official vertical/persona list but does not include it.
  - The README should explicitly say this plan uses the “group coordinator attendee” persona unless the official challenge list requires a different label.

## Product Thesis
- The winning version is not a generic venue chatbot.
- The winning version is a decision assistant that can explain: where to go, whether to go now or wait, why that option is best right now, how long it will take, and what fallback to use if conditions change.
- The user experience should feel like: quick action chips + one chat interface + live recommendation cards.

## Official Decisions Checked On 2026-04-08
- Primary model: `gemini-3.1-flash-lite-preview`
  - Official Gemini docs describe it as the most cost-efficient multimodal model for high-frequency, lightweight agentic tasks.
  - The model page lists support for function calling, structured outputs, thinking, file search, URL context, Google Search grounding, and a 1,048,576 input token limit.
- JavaScript SDK: `@google/genai`
  - Do not use the deprecated `@google/generative-ai` package.
- Core integration pattern: Gemini function calling plus structured JSON output.
- Important architecture rule: Gemini should orchestrate tools and explain decisions, but the actual ranking and routing logic should remain deterministic and testable in application code.

## What We Are Building
- A single chatbot called `Smart Crowd Navigator`.
- The user opens the web app, picks or confirms their section, and taps one of four intents:
  - Food
  - Washroom
  - Entry Gate
  - Exit
- The chatbot then:
  - calls internal tools,
  - fetches live venue state,
  - chooses the least painful option,
  - decides whether the user should go now or wait for a better moment,
  - returns one primary recommendation and one fallback,
  - explains the ETA, wait time, and crowd warning in plain language.

## Why This Version Is Strong
- It maps directly to the brief:
  - crowd movement,
  - waiting times,
  - real-time coordination.
- Judges can understand it in seconds.
- Gemini is used for actual tool orchestration and explanation, not just chat decoration.
- The hard logic stays deterministic, which improves code quality, testing, and trust.
- The timing decision makes the assistant feel genuinely smart instead of looking like a static “nearest place” finder.

## Winning Differentiator
- The app should answer two questions, not one:
  - **Where should I go?**
  - **Should I go now or wait?**
- Example:
  - “Don’t go for food right now. Queue pressure near your section is peaking. Wait 7 minutes and use Stall B instead — total time saved: 9 minutes.”
- This is the feature that best demonstrates:
  - smart dynamic assistance,
  - logical decision making from live context,
  - practical real-world value.

## Recommended Architecture
- Frontend:
  - React + TypeScript + Vite
  - Tailwind for fast UI iteration
  - PWA shell for mobile-first use inside the venue
  - deploy on Firebase Hosting for a clean Google-services story
- Backend:
  - Node.js + TypeScript service on Cloud Run
  - Gemini calls and tool execution happen only on the server
- Data:
  - Firestore for live venue state, queue estimates, user sessions, and operator updates
- Auth and abuse control:
  - Firebase Auth for session identity
  - Firebase App Check for client abuse reduction
  - Firestore Security Rules for data access constraints
- Mapping:
  - Use a custom indoor venue graph for inside-stadium routing
  - Use Google Maps only for outer-perimeter guidance such as parking-to-gate or nearby landmarks

## Why Not Use Google Maps For Indoor Routing
- Indoor stadium navigation is not the same as public road routing.
- The app needs section-aware, stair-aware, concourse-aware paths that depend on venue-specific geometry.
- The correct MVP is:
  - custom venue graph for inside the stadium,
  - Google Maps for outside the stadium,
  - optional Maps grounding only as an enhancement, not a dependency.

## Single-Chatbot Tool Design
- Gemini should act as the planner and explainer.
- The backend should expose a small set of custom tools to Gemini.

### Tool 1: `get_user_context`
- Input: `section`, `seatRow`, `partySize`, `mobilityNeeds`, `intent`
- Returns: normalized user state and nearby venue nodes

### Tool 2: `get_ranked_options`
- Input: `intent`, `section`, `eventPhase`, `mobilityNeeds`
- Returns:
  - ranked destinations,
  - estimated queue time,
  - crowd score,
  - distance score,
  - timing recommendation,
  - recommendation reason codes

### Tool 3: `get_best_route`
- Input: `fromNode`, `toNode`, `mobilityNeeds`
- Returns:
  - path segments,
  - ETA,
  - congestion warnings,
  - accessibility flags

### Tool 4: `get_fallback_option`
- Input: `intent`, `section`, `excludedDestinationId`
- Returns:
  - next best destination,
  - fallback ETA,
  - fallback wait time

### Tool 5: `get_timing_advice`
- Input: `intent`, `section`, `eventPhase`, `currentQueueState`
- Returns:
  - go-now or wait recommendation,
  - suggested delay window,
  - expected time saved,
  - explanation reason codes

### Tool 6: `get_group_meetup_plan`
- Input: `memberSections`, `targetIntent`, `exitPreference`
- Returns:
  - meetup point,
  - staggered departure suggestion,
  - best shared route

## Deterministic Recommendation Engine
- Do not ask Gemini to decide the shortest path directly.
- Do not ask Gemini to invent wait times.
- Build a pure TypeScript decision engine that scores each destination using:
  - walking time,
  - queue length,
  - congestion level,
  - event phase,
  - short-term queue trend,
  - accessibility constraints,
  - whether the user will miss key game moments.

### Example Scoring Formula
- `total_score = route_eta_weight + queue_weight + congestion_weight + event_penalty + trend_penalty + accessibility_penalty`
- Lower score wins.
- Gemini only receives the ranked outputs and explanation metadata.

## Gemini Contract
- Model: `gemini-3.1-flash-lite-preview`
- SDK: `@google/genai`
- Request style:
  - system prompt with strict role and safety boundaries
  - function declarations for internal tools
  - structured output schema for the final assistant response

### Response Schema
- `intent`
- `timing_decision`
- `wait_or_go_reason`
- `primary_option`
- `primary_reason`
- `eta_minutes`
- `wait_minutes`
- `time_saved_minutes`
- `route_summary`
- `crowd_warning`
- `fallback_option`
- `confidence`

This schema keeps the UI predictable and reduces parsing problems.

## Live Data Model
- `venues/{venueId}`
  - metadata, entry gates, exits, section map
- `venues/{venueId}/nodes`
  - sections, stalls, washrooms, gates, exits, meetup points
- `venues/{venueId}/edges`
  - walkable paths, stairs, ramps, closures
- `venues/{venueId}/live_state/current`
  - event phase, crowd hotspots, blocked paths, alerts
- `venues/{venueId}/queues/{destinationId}`
  - wait time estimate, queue length, congestion score, updated timestamp
- `sessions/{sessionId}`
  - user section, preferences, last request, last recommendation
- `operator_events/{eventId}`
  - incident updates used for the demo console

## Core User Flows
- Flow 1: Entry
  - user selects section before entering
  - chatbot recommends least crowded gate and walking approach
- Flow 2: Food run
  - user in Section A taps `Food`
  - chatbot finds the best stall with low queue and acceptable walking time
  - chatbot may say “wait 6 minutes, then go”
- Flow 3: Washroom
  - chatbot prioritizes lower wait time and closest route
- Flow 4: Exit
  - chatbot recommends best exit based on current crowd spread
- Flow 5: Group meetup
  - optional stretch flow for families or friends in different sections

## Judge-Facing Demo Narrative
- Start on a mobile-sized view.
- Set the attendee in one section.
- Ask for food.
- Show one recommendation card with:
  - go now or wait,
  - best stall,
  - ETA,
  - wait time,
  - time saved,
  - route summary,
  - fallback.
- Change live queue data from the operator console.
- Ask again or auto-refresh recommendation.
- Show the answer changing for a clear, visible reason.
- Repeat once for exit or washroom.

## Judging Strategy By Criterion
- Code Quality:
  - typed frontend and backend
  - shared schemas for tool inputs and outputs
  - deterministic engine isolated from UI
- Security:
  - Gemini API key never reaches the browser
  - Firestore Rules restrict writes
  - App Check reduces abusive client traffic
  - Cloud Run endpoints use proper auth where needed
- Efficiency:
  - Flash-Lite minimizes cost and latency
  - route graph calculations stay local to the backend
  - Firestore listeners keep the UI fresh without polling loops everywhere
- Practical usability:
  - users can act with one tap
  - no long prompt-writing is required
  - the answer is phrased in plain language under time pressure
- Testing:
  - unit tests for ranking engine
  - integration tests for tool-calling loop
  - one end-to-end journey for food recommendation
  - one deterministic test for “go now vs wait” timing advice
- Accessibility:
  - keyboard navigation
  - screen-reader labels
  - visible status text instead of color alone
  - large touch targets for in-venue mobile use
- Google Services:
  - Gemini API
  - Firebase Auth
  - Firestore
  - Firebase App Check
  - Firebase Hosting
  - Cloud Run
  - Google Maps for perimeter context

## Recommended Repo Structure
- `apps/web`
  - attendee UI and operator console
- `services/assistant-api`
  - Cloud Run backend, Gemini orchestration, tool execution
- `packages/venue-engine`
  - deterministic ranking and routing logic
- `packages/shared`
  - TypeScript types, zod schemas, constants

## MVP First, Then Stretch
- MVP that should be finished first:
  - one venue map
  - one persona
  - four intents
  - live queue updates
  - go-now vs wait advice
  - one fallback option
  - one operator console
- Stretch only after MVP works:
  - group meetup plan
  - voice input
  - multilingual output
  - outside-the-stadium Maps grounding

## Tasks
- [ ] Lock the product scope to one chatbot and four primary intents.  
      Verify: no extra features remain in scope that do not improve the judged demo.
- [ ] Lock the persona, judging story, and one-sentence pitch before coding.  
      Verify: README intro and demo script both describe the same persona and value proposition.
- [ ] Define the venue graph, destination schema, and live queue schema.  
      Verify: seed JSON can represent sections, stalls, washrooms, gates, exits, and blocked paths.
- [ ] Implement the deterministic ranking and routing engine in `packages/venue-engine`.  
      Verify: changing queue length or congestion changes the winning option predictably.
- [ ] Implement timing advice logic for “go now vs wait”.  
      Verify: the engine can recommend waiting when queue trend makes delay beneficial and show estimated time saved.
- [ ] Implement the Cloud Run backend with Gemini tool declarations and response schema validation.  
      Verify: the backend can complete one full tool-calling cycle and return structured JSON.
- [ ] Build the chat-first attendee UI with quick-action chips and recommendation cards.  
      Verify: user can choose `Food`, `Washroom`, `Entry Gate`, or `Exit` without typing.
- [ ] Build the live operator console that edits queue time, closures, and crowd hotspots.  
      Verify: updating live state changes attendee recommendations within the active session.
- [ ] Add Firebase Auth, Firestore Rules, and App Check.  
      Verify: protected writes fail for unauthorized clients and app secrets remain server-side.
- [ ] Add test coverage for ranking, tool orchestration, and one critical end-to-end flow.  
      Verify: CI or local test commands pass for engine, API, and one UI journey.
- [ ] Write a strong `README` and demo script tied to the judging rubric.  
      Verify: the repository clearly explains the problem, approach, assumptions, and Google service choices.

## Done When
- [ ] A user can open the web app, pick an intent, and receive a clear best option with ETA, wait time, route, and fallback.
- [ ] The recommendation changes correctly when queue or crowd conditions change.
- [ ] The assistant can clearly recommend both “go now” and “wait” in the right situations.
- [ ] The app demonstrates real-time coordination and not just static recommendation cards.
- [ ] The repo shows meaningful use of Gemini and Google services with maintainable code.

## Scope Discipline
- Do not build full turn-by-turn indoor AR navigation.
- Do not let Gemini replace the route engine.
- Do not depend on Google Maps for detailed indoor routing.
- Do not build ten personas; one primary attendee flow is enough.
- Do not add fancy features that weaken the demo story.

## Best Stretch Features
- Voice input for hands-free use while walking
- multilingual output
- family meetup routing
- optional Google Maps grounding for outside-the-stadium location questions

## Official References Used
- Gemini 3.1 Flash-Lite model page: `https://ai.google.dev/gemini-api/docs/models/gemini-3.1-flash-lite-preview`
- Gemini pricing and model guidance: `https://ai.google.dev/gemini-api/docs/pricing`
- Gemini function calling: `https://ai.google.dev/gemini-api/docs/function-calling`
- Gemini tools overview: `https://ai.google.dev/gemini-api/docs/tools`
- Gemini structured outputs: `https://ai.google.dev/gemini-api/docs/structured-output`
- Gemini Maps grounding: `https://ai.google.dev/gemini-api/docs/maps-grounding`
- Firestore realtime listeners: `https://firebase.google.com/docs/firestore/query-data/listen`
- Firestore Security Rules: `https://firebase.google.com/docs/firestore/security/get-started`
- Firebase App Check for web: `https://firebase.google.com/docs/app-check/web/recaptcha-provider`
- Cloud Run service-to-service auth: `https://cloud.google.com/run/docs/authenticating/service-to-service`
- Google Maps JavaScript route polylines: `https://developers.google.com/maps/documentation/javascript/routes/routes-polylines`
