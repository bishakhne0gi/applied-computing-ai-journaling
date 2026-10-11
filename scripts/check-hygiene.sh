#!/usr/bin/env bash
# Fails when private wording or an Anthropic key is tracked. The repo is public.
set -euo pipefail
cd "$(dirname "$0")/.."

pattern='sk-ant-[A-Za-z0-9_-]{10,}|sk-lf-[A-Za-z0-9-]{10,}'
# Private wording lives outside the public repo: one term per line in the git-ignored .hygiene-terms,
# or pipe/newline-separated in HYGIENE_TERMS (CI secret).
terms="${HYGIENE_TERMS:-}"
if [ -f .hygiene-terms ]; then terms="$terms"$'\n'"$(cat .hygiene-terms)"; fi
extra="$(printf '%s\n' "$terms" | tr '|' '\n' | sed '/^[[:space:]]*$/d' | paste -sd '|' -)"
if [ -n "$extra" ]; then pattern="$pattern|$extra"; fi
# git grep exits 0 on match, 1 on none and >1 on error; collapsing the last two would let a broken scan pass.
set +e
matches="$(git grep -nIiE "$pattern" -- . ':(exclude)docs/superpowers' ':(exclude)scripts/check-hygiene.sh')"
status=$?
set -e

case "$status" in
  0)
    echo "$matches" >&2
    echo "hygiene: forbidden wording or secret found" >&2
    exit 1
    ;;
  1) echo "hygiene: clean" ;;
  *)
    echo "hygiene: scan failed (git grep exit $status)" >&2
    exit 1
    ;;
esac
