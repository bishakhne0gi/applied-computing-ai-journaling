#!/usr/bin/env bash
# Fails when private wording or an Anthropic key is tracked. The repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."

pattern='sk-ant-[A-Za-z0-9_-]{10,}'
# Private wording lives outside the public repo: one term per line in the git-ignored .hygiene-terms,
# or pipe/newline-separated in HYGIENE_TERMS (CI secret).
terms="${HYGIENE_TERMS:-}"
if [ -f .hygiene-terms ]; then terms="$terms"$'\n'"$(cat .hygiene-terms)"; fi
extra="$(printf '%s\n' "$terms" | tr '|' '\n' | sed '/^[[:space:]]*$/d' | paste -sd '|' -)"
if [ -n "$extra" ]; then pattern="$pattern|$extra"; fi
matches="$(git ls-files -z -- . ':(exclude)docs/superpowers' ':(exclude)scripts/check-hygiene.sh' \
  | xargs -0 grep -nIiE "$pattern" -- 2>/dev/null || true)"

if [ -n "$matches" ]; then
  echo "$matches" >&2
  echo "hygiene: forbidden wording or secret found" >&2
  exit 1
fi
echo "hygiene: clean"
