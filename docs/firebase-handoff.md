# Firebase Handoff Checklist

Firebase is now partially integrated.

Already implemented:
- Firebase env placeholders
- web config module
- Firestore-backed operator state sync path with local API fallback

Still deferred:
- Firebase Auth
- App Check
- Firebase Hosting deployment

## Values Needed

Provide these values when you want Firebase wired in:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
```

## Decisions Needed

1. Firebase project ID
2. Auth mode:
   - anonymous
   - email/password
   - Google sign-in
   - no-auth-yet
3. Firestore mode:
   - Native mode?
4. Integration mode:
   - emulator-first
   - direct cloud wiring
5. Hosting target details
6. App Check now or later

## Remaining Integration Order

1. Add chosen auth mode
2. Add App Check if requested
3. Add Hosting configuration
4. Remove local-only fallback assumptions where appropriate

## Verification Once Unblocked

- `pnpm verify`
- `pnpm test:e2e`
- Firebase-backed operator update persists correctly
- attendee recommendation refreshes from Firebase-backed state
