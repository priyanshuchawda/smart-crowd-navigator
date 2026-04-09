#!/usr/bin/env bash
set -euo pipefail

api_cmd=(pnpm --filter @smart-crowd-navigator/assistant-api dev)
web_cmd=(pnpm --filter @smart-crowd-navigator/web dev -- --host 127.0.0.1 --port 5173 --strictPort)

cleanup() {
  jobs -pr | xargs -r kill 2>/dev/null || true
}
trap cleanup EXIT INT TERM

echo "==> Starting Smart Crowd Navigator local demo"
echo "    API: http://127.0.0.1:8080"
echo "    Web: http://127.0.0.1:5173"

"${api_cmd[@]}" &
api_pid=$!
"${web_cmd[@]}" &
web_pid=$!

wait "$api_pid" "$web_pid"
