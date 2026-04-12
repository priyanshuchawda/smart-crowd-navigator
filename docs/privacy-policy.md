# Privacy Policy (Draft)

> Replace bracketed placeholders before public launch.

## 1. Who we are

Smart Crowd Navigator is operated by [ORGANIZATION NAME] ("we", "us", "our").

Contact: [PRIVACY CONTACT EMAIL]

## 2. What the product does

Smart Crowd Navigator helps venue attendees choose lower-friction routes and destinations inside an event venue. The service may process attendee request context such as section, mobility preference, event phase, and party size in order to produce recommendations.

## 3. Data we may process

Depending on deployment choices, we may process:
- attendee request inputs submitted in the web app
- operator-authentication data handled by Firebase Auth
- operator state updates for venue conditions
- basic request metadata such as timestamps, error codes, rate-limit events, and security verification results
- analytics or telemetry data if enabled in the deployed environment

## 4. Why we process data

We process data to:
- deliver recommendation responses
- protect the service from abuse
- authenticate and authorize operator access
- monitor uptime, failures, and security events
- improve reliability and operational safety

## 5. Third-party services

The deployed product may rely on:
- Google Gemini API
- Firebase Auth
- Firestore
- Firebase App Check
- Cloud Run / Google Cloud logging and monitoring

Review the deployed configuration and linked vendor terms before launch.

## 6. Data retention

Retention must be finalized before launch.

Recommended defaults:
- keep application logs only as long as needed for security and debugging
- avoid storing unnecessary personal data in Firestore documents
- document analytics retention separately if analytics is enabled

## 7. Security

We use reasonable technical controls such as authentication, authorization, rate limiting, App Check verification, and audit logging. No system can guarantee absolute security.

## 8. User choices

Before public launch, document how users can:
- contact support
- request deletion if any personal data is stored
- ask privacy questions

## 9. Children

If the service is available to minors or school-age users, get legal review before launch.

## 10. Changes

We may update this policy. Public deployments should publish an effective date and changelog policy.
