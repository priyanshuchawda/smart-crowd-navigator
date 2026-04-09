#!/usr/bin/env bash
set -euo pipefail

echo "==> pnpm lint"
pnpm lint

echo "==> pnpm typecheck"
pnpm typecheck

echo "==> pnpm test"
pnpm test

echo "==> pnpm build"
pnpm build

echo "==> local verification complete"
