# Privacy Policy

_Effective for the current repository/demo deployment as of 2026-04-14._

## 1. Operator

Smart Crowd Navigator is currently operated by the deployment operator of:
- the public repository at `https://github.com/priyanshuchawda/smart-crowd-navigator`
- the verified Cloud Run deployment at `https://smart-crowd-navigator-6onqsv3h4a-uc.a.run.app`

For product/privacy questions, use the repository issue tracker:
- `https://github.com/priyanshuchawda/smart-crowd-navigator/issues`

## 2. What the product does

Smart Crowd Navigator helps attendees at large sporting venues choose lower-friction routes and destinations. It may process attendee request context such as section, mobility preference, event phase, party size, and follow-up question text to generate recommendations.

## 3. Data the current product may process

Depending on deployment configuration, the product may process:
- attendee request inputs submitted in the web UI
- conversation history included in follow-up assistant requests
- live venue-state telemetry used for routing decisions
- operator authentication data handled by Firebase Auth
- operator updates written to Firestore-backed live venue state
- request metadata such as timestamps, error codes, rate-limit events, and security verification results
- optional analytics/telemetry data when enabled in the deployed environment

## 4. Why data is processed

Data is processed to:
- produce recommendation responses
- keep live venue guidance current
- protect the service from abuse
- authenticate and authorize operator access
- monitor uptime, failures, and security events
- improve reliability and operational safety

## 5. Third-party services

The current product may rely on:
- Google Gemini API
- Google Maps grounding through Gemini
- Firebase Auth
- Firestore
- Firebase App Check
- Cloud Run
- Google Cloud logging / monitoring

## 6. Data retention

Current recommended retention posture:
- keep logs only as long as needed for debugging, abuse review, and operational safety
- avoid storing unnecessary personal data in Firestore documents
- keep live venue-state documents limited to operational routing inputs
- define analytics retention explicitly before enabling production analytics at scale

## 7. Security

The repository and deployment design include controls such as authentication, authorization, App Check, rate limiting, structured logging, and server-side API key handling. No online system can guarantee absolute security.

## 8. User choices

The current public contact path is the repository issue tracker. Do not post secrets or sensitive personal information in a public issue. If a request requires private follow-up, open an issue asking for a private handoff first.

## 9. Children

If this product is deployed for minors, school-age users, or regulated venue environments, legal review should happen before broad public rollout.

## 10. Changes

This policy may be updated as the hosted product changes. Future public launches should keep the effective date current and record major policy changes in the repository history.
