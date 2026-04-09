# Firebase Handoff Checklist

Firebase integration is the only remaining blocked lane.

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

## Planned Integration Order

1. Add Firebase config module in the web app
2. Replace local in-memory operator state with Firestore-backed state
3. Add chosen auth mode
4. Add App Check if requested
5. Add Hosting configuration

## Verification Once Unblocked

- `pnpm verify`
- `pnpm test:e2e`
- Firebase-backed operator update persists correctly
- attendee recommendation refreshes from Firebase-backed state
