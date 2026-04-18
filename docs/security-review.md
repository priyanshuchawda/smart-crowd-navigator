# Security Review

## Scope

Production-readiness security review of the current Smart Crowd Navigator codebase after the April 11, 2026 hardening pass.

## Completed high-priority fixes

### 1. Operator state writes are now authenticated and authorized

Resolved in repo:

- Firebase Auth-backed operator access path exists in `apps/web/src/firebase.ts`
- Firestore write access is limited by `firestore.rules`
- Node API operator mutations verify Firebase ID tokens in `services/assistant-api/src/operator-auth.ts`

### 2. Public API abuse controls are now in place

Resolved in repo:

- CORS is now explicit-allowlist plus exact same-origin host matching in `services/assistant-api/src/index.ts` (no broad `.run.app` wildcard allowance)
- rate limits on assistant/recommendation/operator write surfaces
- structured operator audit logs for mutation events
- prompt/response hardening and deterministic fallback path
- request-size guards and explicit `413` handling for oversized payloads

### 2.1 Input validation and sanitization boundaries

Current request safety model:

- all assistant and recommendation payloads are validated with shared Zod schemas (`packages/shared/src/contracts.ts`)
- operator mutation payloads are validated server-side with strict Zod objects in `services/assistant-api/src/index.ts`
- body parsing is bounded by `MAX_BODY_BYTES` and rejects large inputs with controlled `413` responses
- malformed JSON or schema-invalid payloads return controlled `400` responses instead of crashing
- CORS origin checks and per-bucket rate limits reduce abuse on public surfaces

Sanitization note:

- this API does not render user-provided HTML and keeps responses JSON-only, so the primary protection model is strict schema validation and bounded parsing rather than HTML sanitization.

Posture note:

- The current limiter is intentionally lightweight and instance-local. It reduces casual abuse but is not equivalent to shared edge enforcement.

### 3. App Check support exists for the web client and Node API

Resolved in repo:

- web App Check bootstrap in `apps/web/src/firebase.ts`
- protected backend routes verify `X-Firebase-AppCheck` in `services/assistant-api/src/app-check.ts`, including recommendation and assistant-response paths

## Remaining production gaps

### 1. Console-side Firebase rollout still must happen

Code support exists, but public launch still requires:

- App Check enforcement in Firebase console
- deployed site key / debug-token hygiene
- operator role provisioning in Firestore/Auth

### 2. Observability still needs deployment-side wiring

Repo support exists for structured logs, including:

- `operator_audit`
- `assistant_fallback`

Still needed outside the repo:

- log sinks / dashboards
- alerting thresholds
- incident notifications

### 3. Public operator-state reads are an intentional product tradeoff

Current posture:

- attendee experiences can read the same live venue-state data that powers recommendations
- Firestore `operator-state` reads and `GET /operator/state` are therefore currently public by design

If that changes later:

- classify operator-state as sensitive operational data
- add authn/authz to the public API read path
- tighten Firestore reads before rollout

### 4. Privacy and public-policy rollout still matters

Before public launch, add and customize:

- privacy policy
- terms / acceptable-use policy
- support/security contact details
- data retention review for analytics/session data

## Current verdict

The codebase is now materially hardened for production compared with the original MVP. Remaining blockers are primarily deployment/configuration, monitoring, and public-policy rollout rather than missing core security controls in the repo.
