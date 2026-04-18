# Assistant Behavior Regression Lane

This lane protects high-risk assistant behavior where model/provider drift can cause subtle regressions.

## Covered scenarios

`services/assistant-api/src/assistant-behavior.baseline.test.ts` currently tracks baselines for:

1. Two-turn function-calling recommendation flow.
2. Maps-grounded response envelope and citation payload shape.
3. Retry behavior across model fallback chain under retryable provider pressure.

## Run locally

From repository root:

```bash
pnpm test:behavior
```

## Update baselines intentionally

Only update baselines when behavior changes are expected and reviewed.

From repository root:

```bash
pnpm test:behavior:update-baselines
```

This command rewrites JSON files in:

- `services/assistant-api/src/behavior-baselines/`

## CI integration

The CI workflow runs this lane in the `Assistant behavior regression` job.

Any mismatch against committed baselines fails that job.
