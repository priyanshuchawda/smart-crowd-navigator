# Production Secrets and API Key Checklist

## Runtime secret policy

- Production must inject secrets through environment variables or Secret Manager-backed references.
- `key.md` and `pnpm setup:local` are local-development helpers only.
- The API now validates that production has a real `GEMINI_API_KEY` unless Gemini is explicitly disabled.
- When operator auth is enabled in production, `FIREBASE_PROJECT_ID` (or `VITE_FIREBASE_PROJECT_ID`) must also be injected.

## Recommended Cloud Run pattern

Example deploy shape:

```bash
gcloud run deploy smart-crowd-navigator-api \
  --image REGION-docker.pkg.dev/PROJECT/REPO/smart-crowd-navigator-api:TAG \
  --set-env-vars NODE_ENV=production,OPERATOR_AUTH_REQUIRED=true,ALLOWED_ORIGINS=https://YOUR_WEB_HOST \
  --set-secrets GEMINI_API_KEY=smart-crowd-gemini-api-key:latest \
  --set-env-vars FIREBASE_PROJECT_ID=YOUR_FIREBASE_PROJECT_ID
```

Recommended Secret Manager contents:

- `GEMINI_API_KEY`

Recommended plain environment variables:

- `NODE_ENV=production`
- `ALLOWED_ORIGINS=<deployed web origin>`
- `OPERATOR_AUTH_REQUIRED=true`
- `FIREBASE_PROJECT_ID=<firebase project id>`

## Firebase production notes

- Provision operator accounts in Firebase Auth.
- Add `operator-roles/{uid}` documents with:

```json
{
  "role": "operator",
  "active": true
}
```

- Deploy `firestore.rules` before enabling production operator writes.

## API key restriction checklist

Use this for future Google Maps / Places browser keys:

- Restrict by application type (HTTP referrers for browser keys).
- Restrict by allowed origins/domains only.
- Restrict by enabled APIs only.
- Create separate keys for dev, staging, and production.
- Rotate keys if leaked or reused outside the intended surface.
- Do not store private server-side keys in the web app.
- Prefer Secret Manager or deploy-time env injection for server-side keys.

## Verification checklist

- Production deploy command uses env vars / Secret Manager references only.
- No production runbook step references `key.md`.
- `pnpm setup:local` remains documented as local-only.
- Browser API keys have origin and API allowlists.
