#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.example ]; then
  echo '.env.example not found' >&2
  exit 1
fi

cp .env.example .env

echo 'setup-local-env: local development helper only (not for production secrets)'

if [ -n "${GEMINI_API_KEY:-}" ]; then
  awk -v key="$GEMINI_API_KEY" 'BEGIN{done=0} /^GEMINI_API_KEY=/{print "GEMINI_API_KEY=" key; done=1; next} {print} END{if(!done) print "GEMINI_API_KEY=" key}' .env > .env.tmp
  mv .env.tmp .env
  echo 'GEMINI_API_KEY populated from current shell environment'
else
  echo 'GEMINI_API_KEY not provided; leaving placeholder in .env'
fi

echo '.env created successfully'
