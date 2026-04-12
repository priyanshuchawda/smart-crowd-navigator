# Cloud Run Deployment

## Goal

Deploy Smart Crowd Navigator so the web app and API are both served from one Cloud Run URL.

Current deployed URL:

`https://smart-crowd-navigator-1051094454693.us-central1.run.app`

## Runtime model

- Cloud Run serves the Node API
- the same service also serves `apps/web/dist`
- the web app uses same-origin API requests by default in deployed environments

## Required environment variables

```env
NODE_ENV=production
PORT=8080
GEMINI_API_KEY=<secret-managed>
GEMINI_MODEL=gemini-3.1-flash-lite-preview
ALLOWED_ORIGINS=<cloud-run-url>
FIREBASE_PROJECT_ID=priyanshu-portfolio-v1
FIREBASE_PROJECT_NUMBER=602429979967
VITE_FIREBASE_API_KEY=AIzaSyDYi0RVup5WbMVF1nqs7OMRiiK5xiBBx24
VITE_FIREBASE_AUTH_DOMAIN=priyanshu-portfolio-v1.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=priyanshu-portfolio-v1
VITE_FIREBASE_STORAGE_BUCKET=priyanshu-portfolio-v1.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=602429979967
VITE_FIREBASE_APP_ID=1:602429979967:web:3c3a7d064bc600cddb278a
VITE_FIREBASE_MEASUREMENT_ID=G-HRF6VGM95G
OPERATOR_AUTH_REQUIRED=true
APP_CHECK_REQUIRED=false
APP_CHECK_ALLOWED_APP_IDS=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=
```

## Deploy shape

Example:

```bash
gcloud run deploy smart-crowd-navigator \
  --source . \
  --region us-central1 \
  --allow-unauthenticated
```

Then update `ALLOWED_ORIGINS` to the final Cloud Run URL if needed.

## Post-deploy checks

- `GET /health` returns 200
- `/` serves the web app shell
- attendee recommendation flow works
- operator endpoints reject unauthorized writes

## Cost posture

- Cloud Run min instances should remain `0`
- use the smallest practical CPU/memory setting
- use same-origin hosting to avoid extra hosting infrastructure
