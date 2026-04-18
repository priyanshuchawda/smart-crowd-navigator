# Release Confidence Checklist

This document defines a lightweight release confidence gate for Smart Crowd Navigator.

## Goal

Make release decisions repeatable, auditable, and low-risk by combining automated checks with explicit manual verification.

## Automated gates (must pass)

Run these checks from the manual release workflow before creating a release tag:

1. `pnpm verify`
2. `pnpm test:e2e` (recommended for production-facing releases)
3. API smoke test after build (`GET /health` returns 200)

If any required gate fails, the release is a no-go.

## Manual verification (release manager)

Before promotion, confirm:

1. Current production incidents are reviewed.
2. Security posture remains valid for the release scope:
   - `OPERATOR_AUTH_REQUIRED=true`
   - `APP_CHECK_REQUIRED=true`
3. No unresolved blocker in QA/security/operations docs:
   - `docs/qa-report.md`
   - `docs/security-review.md`
   - `docs/operations-runbook.md`

## Rollback readiness

Before final release approval:

1. Identify previous known-good revision/deployment.
2. Confirm rollback steps in `docs/operations-runbook.md` are still valid.
3. Confirm post-rollback smoke checks are known and executable.

## Go / no-go decision

Release only when all items below are true:

1. Automated gates are green.
2. Manual verification is complete.
3. Rollback plan is ready and acknowledged.

Otherwise, mark no-go and resolve blockers first.

## Workflow usage

Use `.github/workflows/release-manual.yml` for release readiness execution.

Inputs:

- `release_tag` (required): tag to release, for example `v0.2.0`
- `run_e2e` (optional): include e2e lane in manual run
- `run_smoke` (optional): run built API smoke check
- `create_draft_release` (optional): create draft GitHub release after readiness checks
