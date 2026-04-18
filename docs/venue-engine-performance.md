# Venue Engine Performance Baselines

This document describes the performance regression lane for `@smart-crowd-navigator/venue-engine`.

## What is measured

`packages/venue-engine/src/performance.baseline.test.ts` tracks these hot paths:

1. `rankDestinations` throughput.
2. `getTimingAdvice` throughput.
3. `parseVenueDataSource` throughput.

Each scenario runs with fixed iteration counts and must stay under the committed threshold in `packages/venue-engine/src/perf-baselines.json`.

## Run locally

From repository root:

```bash
pnpm test:perf
```

## Update baselines intentionally

Only update baselines when performance expectations change intentionally.

From repository root:

```bash
pnpm test:perf:update-baselines
```

This updates `packages/venue-engine/src/perf-baselines.json`.

## CI integration

CI executes the `Venue engine performance baselines` job and fails the run if any scenario exceeds its threshold.
