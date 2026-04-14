# Venue Data Contract

## Why this exists

Smart Crowd Navigator is moving from a repository-scoped demo fixture toward a real product architecture.

That means the codebase needs a clear boundary between:
- **venue topology** — the structural map of a venue
- **operational state** — live destination telemetry such as queue and crowd pressure
- **fixture data** — test/dev bootstrap values used only for local development and deterministic verification

## Domain model

The venue-engine package now separates data into three layers:

### 1. `VenueTopology`
Static venue structure:
- `venueId`
- `venueName`
- supported `eventPhases`
- `nodes`
- `edges`

This is the shape a real venue configuration should provide.

### 2. `VenueOperationalState`
Mutable destination telemetry:
- `destinationStates`
- state `version`

This is the shape a live operational feed should provide.

### 3. `VenueDataSource`
The explicit source-of-truth wrapper:
- `source`
- `topology`
- `state`

Supported source labels currently include:
- `local-fixture`
- `production-config`
- `live-operations`

## Current repository usage

### Shipped today
The repository currently boots with `localDevelopmentVenueDataSource` from `packages/venue-engine/src/fixture.ts`.

That path exists to support:
- deterministic tests
- local development
- demo/operator flows already implemented in the app

### Important boundary
The API recommendation layer no longer relies on an implicitly named demo fixture as its source of truth.

Instead, it uses an explicit `VenueDataSource` boundary and can be constructed with a different data source later through `createRecommendationService({ venueDataSource })`.

## How production data should plug in

A production rollout should provide:

1. **real venue topology**
   - sections
   - nodes
   - edges
   - supported event phases

2. **real operational state**
   - destination queue estimates
   - crowd penalties
   - short-term trend values
   - service-time assumptions

3. **source wiring at the API boundary**
   - inject a `production-config` or `live-operations` `VenueDataSource`
   - avoid using the local fixture in production bootstrap paths

## Test/dev policy

Fixture/mock values should remain limited to:
- automated tests
- local development
- deterministic demo verification

They should not be treated as the long-term production source of truth.

## Related files

- `packages/venue-engine/src/types.ts`
- `packages/venue-engine/src/data-source.ts`
- `packages/venue-engine/src/fixture.ts`
- `services/assistant-api/src/recommendation.ts`
