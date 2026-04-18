# Cloud Run Deployment

## Goal

Deploy Smart Crowd Navigator so the web app and API are both served from one Cloud Run URL.

Current deployed URL:

`https://smart-crowd-navigator-6onqsv3h4a-uc.a.run.app`

## Runtime model

- Cloud Run serves the Node API
- the same service also serves `apps/web/dist`
- container runtime includes only `apps/web/dist` and a production `services/assistant-api` deploy bundle
- the web app uses same-origin API requests by default in deployed environments

## Required environment variables

```env
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=<secret-managed>
GEMINI_MODEL=gemini-3.1-flash-lite-preview
ALLOWED_ORIGINS=<cloud-run-url>
FIREBASE_PROJECT_ID=<firebase-project-id>
FIREBASE_PROJECT_NUMBER=<firebase-project-number>
VITE_FIREBASE_API_KEY=<firebase-web-api-key>
VITE_FIREBASE_AUTH_DOMAIN=<firebase-auth-domain>
VITE_FIREBASE_PROJECT_ID=<firebase-project-id>
VITE_FIREBASE_STORAGE_BUCKET=<firebase-storage-bucket>
VITE_FIREBASE_MESSAGING_SENDER_ID=<firebase-messaging-sender-id>
VITE_FIREBASE_APP_ID=<firebase-web-app-id>
VITE_FIREBASE_MEASUREMENT_ID=<firebase-measurement-id>
OPERATOR_AUTH_REQUIRED=true
APP_CHECK_REQUIRED=true
APP_CHECK_ALLOWED_APP_IDS=1:602429979967:web:3c3a7d064bc600cddb278a
VITE_FIREBASE_APPCHECK_SITE_KEY=<recaptcha-enterprise-site-key>
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=
```

Production posture:

- App Check is required for protected backend routes in public production deployments.
- `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN` should stay empty in production and only be used for localhost / CI debugging.
- `APP_CHECK_ALLOWED_APP_IDS` should explicitly list the deployed web app ids allowed to call the API.

## Deploy shape

Example:

```bash
gcloud run deploy smart-crowd-navigator \
  --source . \
  --region us-central1 \
  --set-env-vars NODE_ENV=production,OPERATOR_AUTH_REQUIRED=true,APP_CHECK_REQUIRED=true,ALLOWED_ORIGINS=https://YOUR_WEB_HOST,FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID,FIREBASE_PROJECT_NUMBER=YOUR_FIREBASE_PROJECT_NUMBER,APP_CHECK_ALLOWED_APP_IDS=1:YOUR_PROJECT_NUMBER:web:YOUR_APP_ID \
  --set-secrets GEMINI_API_KEY=smart-crowd-gemini-api-key:latest \
  --allow-unauthenticated
```

Then build/deploy the web app with the matching Firebase env values, especially `VITE_FIREBASE_APPCHECK_SITE_KEY`, and update `ALLOWED_ORIGINS` to the final Cloud Run URL if needed.

## Post-deploy checks

- `GET /health` returns 200
- `/` serves the web app shell
- attendee recommendation flow works
- operator endpoints reject unauthorized writes
- protected routes reject requests without App Check

## Observability rollout

The service now emits structured Cloud Logging events for:

- `recommendation_observability`
- `assistant_observability`
- `assistant_fallback`

Recommended log-based metrics:

```bash
gcloud logging metrics create crowdnav_recommendation_count \
  --description="Count of recommendation requests" \
  --log-filter='jsonPayload.type="recommendation_observability"'

gcloud logging metrics create crowdnav_assistant_fallback_count \
  --description="Count of assistant fallback events" \
  --log-filter='jsonPayload.type="assistant_fallback"'
```

For latency distribution, create a metric from a JSON config using
`jsonPayload.latencyMs` as the extracted value.

## Cost posture

- Cloud Run min instances should remain `0`
- use the smallest practical CPU/memory setting
- use same-origin hosting to avoid extra hosting infrastructure
