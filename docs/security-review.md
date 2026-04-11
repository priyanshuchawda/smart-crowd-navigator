# Security Review

## Scope
Production-readiness security review of the current Smart Crowd Navigator codebase.

## Current High-Priority Risks

### 1. Operator state can be modified without authentication or authorization
Current code paths allow operator-state writes through public web/API flows.

Repo-grounded evidence:
- `apps/web/src/firebase.ts` writes operator state directly with Firestore client SDK.
- `services/assistant-api/src/index.ts` exposes `/operator/state`, `/operator/state/bulk`, and `/operator/reset` without auth.

Production fix:
- add Firebase Auth
- define operator/admin role model
- add Firestore Security Rules
- restrict operator endpoints to authorized actors only

### 2. API surface is public and expensive endpoints are unprotected
`/assistant-response` can trigger paid model usage and `/operator/*` mutates live state.

Repo-grounded evidence:
- wildcard CORS in `services/assistant-api/src/index.ts`
- no auth checks or rate limiting on live endpoints

Production fix:
- origin allowlist
- auth or signed access for operator mutations
- rate limiting and abuse controls
- audit logging

### 3. App Check is not enabled yet
Without App Check, browser traffic can be replayed or abused more easily.

Production fix:
- add App Check for web
- enforce where possible in Firebase-backed flows

## Medium Risks

### 4. Real Gemini outages currently fall back correctly, but outage visibility is weak
Fallback is good for UX, but operators may need observability to know Gemini is degraded.

Production fix:
- structured logs and counters for fallback usage
- alerting/monitoring for upstream failures

### 5. Large build chunk warning
Not a security issue by itself, but performance and bundle discipline matter in production.

Production fix:
- code splitting
- lazy-load heavy Firebase/Gemini-adjacent paths where practical

### 6. key.md local-helper path is fine for dev, not for production
Local convenience is acceptable, but production should rely on deploy-time secret injection only.

Production fix:
- Cloud Run env vars / Secret Manager
- no runtime dependence on `key.md`

## Lower-Priority / Future
- App-level audit views for operator changes
- stronger multi-operator concurrency controls
- privacy/data retention review for analytics and session data

## Recommended Security Backlog
- #53 Harden operator access with Firebase Auth and Firestore rules
- #54 Add App Check and protect backend/API surfaces
- #55 Harden Node API against abuse and oversized input
- #56 Production secret handling and API key restrictions
- #57 Prompt and response hardening for production assistant behavior

## Current Verdict
The current build is suitable as an MVP/demo, but not yet production-secure until operator authz, App Check, API hardening, and production secret handling are completed.
