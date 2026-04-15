# Firebase Handoff Checklist

Firebase is now partially integrated.

Already implemented:
- Firebase env placeholders
- web config module
- Firestore-backed live venue state sync path with local API fallback
- Firebase email/password operator sign-in path
- Firestore security rules for operator/admin-only writes
- Firebase App Check web bootstrap path
- Node API support for `X-Firebase-AppCheck` verification

Still deferred:
- Firebase console-side App Check enforcement rollout
- Firebase Hosting deployment

## Values Needed

Provide these values when you want Firebase wired in:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_PROJECT_NUMBER=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
VITE_FIREBASE_APPCHECK_SITE_KEY=
VITE_FIREBASE_APPCHECK_DEBUG_TOKEN=
APP_CHECK_REQUIRED=true
APP_CHECK_ALLOWED_APP_IDS=1:YOUR_PROJECT_NUMBER:web:YOUR_APP_ID
OPERATOR_AUTH_REQUIRED=true
OPERATOR_ROLE_COLLECTION=operator-roles
```

## Decisions Needed

1. Firebase project ID
2. Operator accounts to provision in Firebase Auth (email/password)
3. App Check console rollout details:
   - Firestore enforcement on/off
   - registered debug tokens for localhost/CI
4. Firestore mode:
   - Native mode?
5. Integration mode:
   - emulator-first
   - direct cloud wiring
6. Hosting target details

## Remaining Integration Order

1. Provision `operator-roles/{uid}` documents with `{ role: "operator" | "admin", active: true }`
2. Create the canonical live state document at `venue-live-state/demoVenue`
3. Treat `venue-live-state/{venueId}` as the production source of truth for venue telemetry
4. Register the web app in App Check with a reCAPTCHA Enterprise site key
5. Safelist debug tokens for localhost/CI as needed
6. Enable Firestore App Check enforcement in the Firebase console when ready
7. Add Hosting configuration
8. Remove local-only fallback assumptions where appropriate

## Verification Once Unblocked

- `pnpm verify`
- `pnpm test:e2e`
- app obtains App Check tokens in configured environments
- Node API rejects protected requests without `X-Firebase-AppCheck` when `APP_CHECK_REQUIRED=true`
- Firebase-backed operator update persists correctly
- attendee recommendation refreshes from Firebase-backed state
