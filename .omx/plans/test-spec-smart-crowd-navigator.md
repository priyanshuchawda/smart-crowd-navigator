# Test Spec: Smart Crowd Navigator

## Test Objectives
Validate that the product is deterministic, demo-ready, and safe to merge issue-by-issue.

## Test Layers

### 1. Unit Tests (Vitest)
Focus:
- ranking score calculation
- route selection
- timing advice (`go_now` vs `wait`)
- fallback generation
- response schema validation helpers

Must-have cases:
- lower queue beats closer location when total time is lower
- accessibility constraints override faster inaccessible path
- wait recommendation triggers when short-term trend yields net time savings
- fallback excludes primary destination

### 2. Integration Tests (Vitest)
Focus:
- backend tool orchestration
- Gemini request construction
- structured response parsing
- API handler outputs from mock tool results

Must-have cases:
- tool-calling cycle returns valid structured JSON
- invalid model output is rejected/fails safely
- backend never exposes API key to client-facing payloads

### 3. End-to-End Tests (Playwright)
Focus:
- user taps Food -> receives recommendation card
- recommendation changes after simulated live update
- user can request Exit and receive updated route guidance

Must-have journey:
1. Open app
2. Select section
3. Tap Food
4. See `go now` or `wait`
5. Trigger operator state change
6. Verify recommendation card updates

## Merge Gates
Before merging any implementation PR:
- relevant unit/integration tests pass
- build passes
- affected-file diagnostics are clean
- manual live verification completed for UI-facing issues

## Issue-Specific Verification Strategy
- Scaffolding issues: install/build/lint/typecheck
- Engine issues: deterministic unit tests
- Backend issues: integration tests + local curl/manual checks
- UI issues: Playwright + manual browser verification
- Operator issues: live state change demo evidence

## Deferred Areas
- Firebase integration tests are deferred until Firebase details are provided.
