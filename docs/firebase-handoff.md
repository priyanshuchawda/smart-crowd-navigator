# Firebase Handoff Checklist

Firebase is now partially integrated.

Already implemented:
- Firebase env placeholders
- web config module
- Firestore-backed operator state sync path with local API fallback
- Firebase email/password operator sign-in path
- Firestore security rules for operator/admin-only writes

Still deferred:
- App Check
- Firebase Hosting deployment

## Values Needed

Provide these values when you want Firebase wired in:

```env
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_FIREBASE_MEASUREMENT_ID=
OPERATOR_AUTH_REQUIRED=true
OPERATOR_ROLE_COLLECTION=operator-roles
```

## Decisions Needed

1. Firebase project ID
2. Operator accounts to provision in Firebase Auth (email/password)
3. Firestore mode:
   - Native mode?
4. Integration mode:
   - emulator-first
   - direct cloud wiring
5. Hosting target details
6. App Check now or later

## Remaining Integration Order

1. Provision `operator-roles/{uid}` documents with `{ role: "operator" | "admin", active: true }`
2. Add App Check if requested
3. Add Hosting configuration
4. Remove local-only fallback assumptions where appropriate

## Verification Once Unblocked

- `pnpm verify`
- `pnpm test:e2e`
- Firebase-backed operator update persists correctly
- attendee recommendation refreshes from Firebase-backed state
