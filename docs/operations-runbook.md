# Operations Runbook

## Purpose

This runbook covers the minimum operating procedure for a public Smart Crowd Navigator deployment.

## Production readiness prerequisites

- Cloud Run deployment uses Secret Manager-backed `GEMINI_API_KEY`
- `NODE_ENV=production`
- `ALLOWED_ORIGINS` matches the deployed web domain
- `OPERATOR_AUTH_REQUIRED=true`
- `APP_CHECK_REQUIRED=true`
- `FIREBASE_PROJECT_ID` and `FIREBASE_PROJECT_NUMBER` are set
- Firestore rules are deployed
- App Check is enabled in the Firebase console for the intended products
- Production build does not use an App Check debug token
- Operator accounts and `operator-roles/{uid}` documents are provisioned

## Current security posture decisions

### Public operator-state reads

- The attendee demo intentionally reads the shared live `operator-state` dataset so recommendation cards can reflect the same venue conditions shown to operators.
- Treat that data as publishable venue telemetry, not private operator-only data.
- If the venue later classifies queue/crowd state as sensitive operational data, tighten both:
  - `GET /operator/state` in `services/assistant-api/src/index.ts`
  - `read` access on `operator-state` in `firestore.rules`

### Rate limiting

- The current `rate_limited` responses come from an in-memory per-instance limiter in the Node API.
- This is a baseline abuse control for local/dev and low-scale deployment, not a distributed production guarantee.
- Future hardening can move this responsibility to shared infrastructure such as Cloud Armor, an API gateway, or a centralized rate-limit store if the traffic profile requires it.

## Key runtime signals to monitor

### Must-watch signals
- `GET /health` availability
- Cloud Run request error rate
- Cloud Run latency for `/assistant-response`
- Gemini fallback events (`"type":"assistant_fallback"`)
- App Check verification failures (`app_check_required`, `invalid_app_check`, `app_check_forbidden`)
- Operator auth failures (`operator_auth_required`, `operator_forbidden`, `invalid_token`)
- Rate-limit spikes (`rate_limited` responses)

### Useful structured log events
- `operator_audit`
- `assistant_fallback`

## Deploy checklist

1. Deploy backend image to Cloud Run
2. Confirm env vars and secrets are present
3. Deploy web build with the correct Firebase/App Check values
   - `VITE_FIREBASE_APPCHECK_SITE_KEY` set
   - `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` empty in production
4. Deploy Firestore rules
5. Verify App Check enforcement configuration in Firebase console
6. Run smoke checks:
   - `/health`
   - attendee recommendation flow
   - operator sign-in
   - operator update flow
   - expected rejection without App Check / operator auth

## Incident triage

### Gemini degraded or failing
Symptoms:
- spike in `assistant_fallback`
- increased latency on `/assistant-response`

Actions:
1. Check recent Cloud Run logs for `assistant_fallback`
2. Verify Gemini API status / credentials
3. Confirm the app is still serving deterministic fallback responses
4. If needed, temporarily set `DISABLE_GEMINI_ASSISTANT=true` for stable degraded mode

### App Check failures spike
Symptoms:
- more `app_check_required`, `invalid_app_check`, or `app_check_forbidden`

Actions:
1. Confirm deployed web app has the correct App Check site key
2. Verify backend `FIREBASE_PROJECT_NUMBER` / allowed app ids
3. Confirm Firebase console enforcement/debug-token configuration
4. Roll back recent App Check config changes if legitimate traffic is blocked

### Operator access failures
Symptoms:
- operators cannot update/reset live state

Actions:
1. Verify operator account exists in Firebase Auth
2. Verify `operator-roles/{uid}` doc exists and `active=true`
3. Confirm ID token validation envs (`FIREBASE_PROJECT_ID`)
4. Confirm App Check is not blocking legitimate operator traffic

## Rollback procedure

Use rollback if a deploy breaks attendee recommendations, operator updates, or auth/App Check flows.

1. Roll back Cloud Run to the previous working revision
2. Revert web hosting to the previous working build
3. Re-check `/health`
4. Run one attendee flow and one operator flow manually
5. Review logs for continuing auth/App Check/fallback errors

## Post-incident notes

Capture:
- impact window
- user-facing symptoms
- root cause
- rollback or mitigation used
- follow-up issue/PR link
