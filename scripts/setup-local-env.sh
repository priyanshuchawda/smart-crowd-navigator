#!/usr/bin/env bash
set -euo pipefail

if [ ! -f .env.example ]; then
  echo '.env.example not found' >&2
  exit 1
fi

cp .env.example .env

if [ -f key.md ]; then
  key=$(grep -o 'AIza[[:alnum:]_-]*' key.md | head -n1 || true)
  if [ -n "$key" ]; then
    awk -v key="$key" 'BEGIN{done=0} /^GEMINI_API_KEY=/{print "GEMINI_API_KEY=" key; done=1; next} {print} END{if(!done) print "GEMINI_API_KEY=" key}' .env > .env.tmp
    mv .env.tmp .env
    echo 'GEMINI_API_KEY populated from key.md'
  else
    echo 'No Gemini key found in key.md; leaving placeholder in .env'
  fi
else
  echo 'key.md not found; leaving placeholder in .env'
fi

echo '.env created successfully'
