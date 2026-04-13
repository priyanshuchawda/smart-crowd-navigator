#!/usr/bin/env bash
set -euo pipefail

echo "==> pnpm lint"
pnpm lint

echo "==> pnpm typecheck"
pnpm typecheck

echo "==> build workspace libraries required by tests"
pnpm --filter @smart-crowd-navigator/shared build
pnpm --filter @smart-crowd-navigator/venue-engine build

echo "==> pnpm test"
pnpm test

echo "==> pnpm build"
pnpm build

echo "==> local verification complete"
