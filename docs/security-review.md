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
- CORS allowlist in `services/assistant-api/src/index.ts`
- rate limits on assistant/operator write surfaces
- structured operator audit logs for mutation events
- prompt/response hardening and deterministic fallback path

### 3. App Check support exists for the web client and Node API
Resolved in repo:
- web App Check bootstrap in `apps/web/src/firebase.ts`
- protected backend routes verify `X-Firebase-AppCheck` in `services/assistant-api/src/app-check.ts`

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

### 3. Privacy and public-policy rollout still matters
Before public launch, add and customize:
- privacy policy
- terms / acceptable-use policy
- support/security contact details
- data retention review for analytics/session data

## Current verdict
The codebase is now materially hardened for production compared with the original MVP. Remaining blockers are primarily deployment/configuration, monitoring, and public-policy rollout rather than missing core security controls in the repo.
